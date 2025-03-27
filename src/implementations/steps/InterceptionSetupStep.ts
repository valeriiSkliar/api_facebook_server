import { AbstractScraperStep } from '../../interfaces/AbstractScraperStep';
import { ScraperContext } from '../../models/ScraperContext';
import { AdData } from '../../models/AdData';
import { RequestCaptureService } from '../../services/RequestCaptureService';
import { Log } from 'crawlee';

export class InterceptionSetupStep extends AbstractScraperStep {
  private requestCapture: RequestCaptureService;

  constructor(name: string, logger: any) {
    super(name, logger);
    // Initialize the RequestCaptureService
    this.requestCapture = new RequestCaptureService(logger as Log);
  }

  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    // Handle requests
    await context.state.page.route('**/api/graphql**', async (route) => {
      const request = route.request();

      // Capture and analyze important requests
      if (
        request.url().includes('api/graphql/') &&
        request.method() === 'POST'
      ) {
        try {
          await this.requestCapture.captureRequest(request);
        } catch (error) {
          this.logger.error('Error capturing request:', error);
        }
      }

      // Always continue the request
      await route.continue();
    });

    // Handle responses
    context.state.page.on('response', async (response) => {
      const url = response.url();

      // Only process GraphQL API responses that contain ad data
      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
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
        const responseJson = JSON.parse(potentialJson);

        const adNodes: AdData[] = [];

        // Extract ad nodes from the response
        if (
          responseJson.data?.ad_library_main?.search_results_connection
            ?.edges &&
          Array.isArray(
            responseJson.data.ad_library_main.search_results_connection.edges,
          )
        ) {
          const edges =
            responseJson.data.ad_library_main.search_results_connection.edges;

          // Process each edge
          for (const edge of edges) {
            if (
              edge.node?.collated_results &&
              Array.isArray(edge.node.collated_results)
            ) {
              // Extract each ad's data
              for (const result of edge.node.collated_results) {
                if (!result) continue;

                try {
                  const adData: AdData = {
                    adArchiveId: result.ad_archive_id || '',
                    adId: result.ad_id || null,
                    pageId: result.page_id || '',
                    pageName: result.page_name || '',
                    snapshot: result.snapshot || {},
                    startDate: result.start_date || null,
                    endDate: result.end_date || null,
                    status: result.is_active ? 'ACTIVE' : 'INACTIVE',
                    publisherPlatform: Array.isArray(result.publisher_platform)
                      ? result.publisher_platform
                      : [],
                    rawData: result,
                  };

                  // Only add if we have the minimum required data
                  if (adData.adArchiveId && adData.pageId) {
                    adNodes.push(adData);
                  } else {
                    this.logger.warn('Skipping ad with missing required data');
                  }
                } catch (adError) {
                  this.logger.error('Error processing individual ad:', adError);
                  continue;
                }
              }
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
