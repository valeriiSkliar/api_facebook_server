import { AbstractScraperStep } from '../../scrapers/common/interfaces/abstract-scraper-step';
import { ScraperContext } from '../../models/ScraperContext';
import { AdData } from '../../models/AdData';
import { RequestCaptureService } from '../../services/RequestCaptureService';
import { ResponseCacheService } from '../../services/ResponseCacheService';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { AdDataDto } from '@src/api/dto/facebook';
const SnapshotSchema = z
  .object({
    body: z
      .object({
        text: z.string().optional(),
      })
      .nullable()
      .optional(),
    images: z
      .array(
        z.object({
          url: z.string().optional(),
        }),
      )
      .optional(),
    videos: z
      .array(
        z.object({
          url: z.string().optional(),
        }),
      )
      .optional(),
  })
  .catchall(z.unknown());

const AdNodeSchema = z.object({
  ad_archive_id: z.string(),
  ad_id: z.string().nullable(),
  page_id: z.string(),
  page_name: z.string(),
  snapshot: SnapshotSchema,
  start_date: z.number().nullable(),
  end_date: z.number().nullable(),
  is_active: z.boolean(),
  publisher_platform: z.array(z.string()).default([]),
});

const EdgeSchema = z.object({
  node: z.object({
    collated_results: z.array(AdNodeSchema),
  }),
});

const AdResponseSchema = z.object({
  data: z.object({
    ad_library_main: z.object({
      search_results_connection: z.object({
        edges: z.array(EdgeSchema),
      }),
    }),
  }),
});

export class InterceptionSetupStep extends AbstractScraperStep {
  private requestCapture: RequestCaptureService;
  private responseCache: ResponseCacheService;

  constructor(name: string, logger: Logger) {
    super(name, logger);
    this.requestCapture = new RequestCaptureService(logger);
    this.responseCache = new ResponseCacheService(logger);
  }

  async execute(context: ScraperContext): Promise<boolean> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    // Handle requests
    this.logger.log('Setting up request interception');
    await context.state.page.route(
      '**facebook.com/api/graphql**',
      async (route) => {
        const request = route.request();

        // Capture and analyze important requests
        if (
          request.url().includes('api/graphql/') &&
          request.method() === 'POST'
        ) {
          try {
            this.logger.log('Capturing request:', request.url());
            await this.requestCapture.captureRequest(request);
            this.logger.log('Request captured');
          } catch (error) {
            this.logger.error('Error capturing request:', error);
          }
        }

        // Always continue the request
        await route.continue();
      },
    );

    // Handle responses
    this.logger.log(
      'Setting up response interception. page:',
      context.state.page.url(),
    );
    context.state.page.on('response', async (response) => {
      const url = response.url();

      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
          this.logger.log('Processing response:', url);

          // Try to get text immediately and cache it
          try {
            const responseText = await response.text();
            const responseId = await this.responseCache.cacheResponse(
              url,
              responseText,
            );
            await this.processResponse(responseId, context, response.status());
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Could not access response content: ${message}`);
            return;
          }
        } catch (responseError) {
          this.logger.error('Error processing response:', responseError);
          context.state.errors.push(responseError as Error);
        }
      }
    });
    return true;
  }

  private async processResponse(
    responseId: string,
    context: ScraperContext,
    status: number,
  ): Promise<void> {
    const cachedResponse = this.responseCache.getCachedResponse(responseId);
    if (!cachedResponse) {
      this.logger.warn(`Cached response not found: ${responseId}`);
      return;
    }

    if (status !== 200) {
      this.logger.warn(`Skipping response with status ${status}`);
      return;
    }

    const responseText = cachedResponse.text;

    if (
      responseText.includes('ad_library_main') &&
      responseText.includes('search_results_connection')
    ) {
      this.logger.log('Intercepted ad data response');

      try {
        const adData = await this.extractAdData(responseText);

        if (adData.length > 0) {
          const newAds = adData.filter(
            (ad) =>
              !context.state.adsCollected.some(
                (existing) => existing.adArchiveId === ad.adArchiveId,
              ),
          );

          if (newAds.length > 0) {
            context.state.adsCollected.push(...newAds);
            this.logger.log(
              `Added ${newAds.length} new ads. Total collected: ${context.state.adsCollected.length}`,
            );

            const maxAds = context.options.behavior?.maxAdsToCollect || 200;
            if (context.state.adsCollected.length >= maxAds) {
              this.logger.log(`Reached maximum of ${maxAds} ads to collect`);
              context.state.hasMoreResults = false;
            }
          }
        }
      } catch (error) {
        const parseError =
          error instanceof Error
            ? error
            : new Error('Unknown error during parsing');
        this.logger.error('Error parsing response JSON:', parseError);
        context.state.errors.push(parseError);
      }
    }

    // Cleanup cached response after processing
    this.responseCache.deleteCachedResponse(responseId);
  }

  private async extractAdData(responseText: string): Promise<AdData[]> {
    try {
      // Find the JSON content
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const potentialJson = responseText.substring(jsonStart, jsonEnd + 1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsedJson = JSON.parse(potentialJson);
        const validatedData = AdResponseSchema.parse(parsedJson);

        const adNodes: AdData[] = [];
        const edges =
          validatedData.data.ad_library_main.search_results_connection.edges;

        for (const edge of edges) {
          for (const result of edge.node.collated_results) {
            const adData: AdData = {
              adArchiveId: result.ad_archive_id,
              adId: result.ad_id,
              pageId: result.page_id,
              pageName: result.page_name,
              snapshot: result.snapshot,
              startDate: result.start_date ?? 0,
              endDate: result.end_date ?? 0,
              status: result.is_active ? 'ACTIVE' : 'INACTIVE',
              publisherPlatform: result.publisher_platform,
              rawData: result,
            };

            // Create and validate the DTO
            try {
              const adDataDto = plainToInstance(AdDataDto, adData);
              await validateOrReject(adDataDto, {
                skipMissingProperties: true,
                forbidUnknownValues: false,
              });

              // If validation passes, add to collection
              if (adData.adArchiveId && adData.pageId) {
                adNodes.push(adData);
              }
            } catch (validationError) {
              this.logger.warn('Ad data validation failed', validationError);
              // Optionally log detailed validation errors if needed
            }
          }
        }

        return adNodes;
      }
    } catch (error) {
      this.logger.error('Error extracting ad data:', error);
    }

    return [];
  }
}
