import { AbstractScraperStep } from '../../interfaces/AbstractScraperStep';
import { ScraperContext } from '../../models/ScraperContext';
import { AdData } from '../../models/AdData';
import { RequestCaptureService } from '../../services/RequestCaptureService';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

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

  constructor(name: string, logger: Logger) {
    super(name, logger);
    // Initialize the RequestCaptureService
    this.requestCapture = new RequestCaptureService(logger);
  }

  async execute(context: ScraperContext): Promise<void> {
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

      // Only process GraphQL API responses that contain ad data
      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
          this.logger.log('Processing response:', url);
          const responseText = await response.text();
          const status = response.status();

          // Log response details for debugging
          this.logger.debug(`GraphQL Response Status: ${status}`);
          this.logger.debug(`GraphQL Response URL: ${url}`);

          // Only process successful responses
          if (status !== 200) {
            this.logger.warn(`Skipping response with status ${status}`);
            return;
          }

          // Check if the response contains ad data
          if (
            responseText.includes('ad_library_main') &&
            responseText.includes('search_results_connection')
          ) {
            this.logger.log('Intercepted ad data response');

            try {
              // Parse the response data
              const adData = this.extractAdData(responseText);

              if (adData.length > 0) {
                // Add to the collected ads, ensuring no duplicates
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

                  // Check if we've reached the maximum
                  const maxAds =
                    context.options.behavior?.maxAdsToCollect || 200;
                  if (context.state.adsCollected.length >= maxAds) {
                    this.logger.log(
                      `Reached maximum of ${maxAds} ads to collect`,
                    );
                    context.state.hasMoreResults = false;
                  }
                } else {
                  this.logger.debug('No new unique ads found in response');
                }
              } else {
                this.logger.debug('No ads found in response');
              }
            } catch (parseError) {
              this.logger.error('Error parsing response JSON:', parseError);
              context.state.errors.push(parseError as Error);
            }
          }
        } catch (responseError) {
          this.logger.error('Error processing response:', responseError);
          context.state.errors.push(responseError as Error);
        }
      }
    });
  }

  private extractAdData(responseText: string): AdData[] {
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

            if (adData.adArchiveId && adData.pageId) {
              adNodes.push(adData);
            } else {
              this.logger.warn('Skipping ad with missing required data');
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
