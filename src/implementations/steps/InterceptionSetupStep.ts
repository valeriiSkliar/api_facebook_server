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

    context.state.page.on('response', async (response) => {
      const url = response.url();

      // Only process GraphQL API responses that contain ad data
      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
          const responseText = await response.text();

          // Check if the response contains ad data
          if (
            responseText.includes('ad_library_main') &&
            responseText.includes('search_results_connection')
          ) {
            this.logger.debug('Intercepted ad data response');

            try {
              // Parse the response data
              const adData = this.extractAdData(responseText);

              if (adData.length > 0) {
                // Add to the collected ads
                context.state.adsCollected.push(...adData);
                this.logger.debug(
                  `Total ads collected: ${context.state.adsCollected.length}`,
                );

                // Check if we've reached the maximum
                const maxAds = context.options.behavior?.maxAdsToCollect || 200;
                if (context.state.adsCollected.length >= maxAds) {
                  this.logger.debug(
                    `Reached maximum of ${maxAds} ads to collect`,
                  );
                  context.state.hasMoreResults = false;
                }
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
      // Sometimes responses might have non-standard JSON characters
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
                const adData: AdData = {
                  adArchiveId: result.ad_archive_id,
                  adId: result.ad_id,
                  pageId: result.page_id,
                  pageName: result.page_name,
                  snapshot: result.snapshot || {},
                  startDate: result.start_date,
                  endDate: result.end_date,
                  status: result.is_active ? 'ACTIVE' : 'INACTIVE',
                  publisherPlatform: result.publisher_platform || [],
                  rawData: result, // Store the complete raw data
                };

                adNodes.push(adData);
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
