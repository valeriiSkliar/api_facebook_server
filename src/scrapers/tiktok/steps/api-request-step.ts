import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { TiktokScraperStep } from './tiktok-scraper-step';
import {
  TiktokMaterial,
  TiktokScraperContext,
  TikTokApiResponse,
} from '../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class ApiRequestStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (!context.state.apiConfig) {
      throw new Error(
        'API configuration is missing. GetApiConfigStep must be executed first.',
      );
    }

    try {
      // Generate a unique request ID
      const requestId = uuidv4();
      this.logger.log(`Starting TikTok API request (ID: ${requestId})`);

      // Initialize currentPage if undefined
      context.state.currentPage = context.state.currentPage || 0;

      // Extract API configuration that was set in the previous step
      const { headers, url } = context.state.apiConfig;

      // Build the API URL with query parameters
      const apiEndpoint = new URL(url);

      // Map our context query to TikTok API parameters
      const { query } = context;

      // Add query parameters
      if (query.queryString) {
        apiEndpoint.searchParams.set('keyword', query.queryString);
      }

      // Add period/timeframe parameter if set
      if (query.period) {
        apiEndpoint.searchParams.set('period', query.period.toString());
      }

      // Add page number for pagination
      const currentPage = context.state.currentPage || 0;
      apiEndpoint.searchParams.set('page', (currentPage + 1).toString());

      // Add sorting parameter
      if (query.orderBy) {
        apiEndpoint.searchParams.set('order_by', query.orderBy);
      }

      // Add country code filter
      if (query.countryCode && query.countryCode.length > 0) {
        apiEndpoint.searchParams.set('country_code', query.countryCode[0]);
      }

      this.logger.log(`Making API request to: ${apiEndpoint.toString()}`);

      // Set up headers from API config
      const headersWithAuth = {
        ...headers,
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
      };

      // Make the API request
      const response = await axios.get<TikTokApiResponse>(
        apiEndpoint.toString(),
        {
          headers: headersWithAuth,
        },
      );

      this.logger.log(
        `API request succeeded. Processing data... ${JSON.stringify(response)}`,
      );
      // Handle the response
      if (response.status !== 200) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      // Extract material IDs from the response
      const searchData = response.data;

      // Save the raw API response in context for debugging/reference
      context.state.rawApiResponse = searchData;

      // Process ad materials from the response
      if (
        searchData?.data?.materials &&
        Array.isArray(searchData.data.materials)
      ) {
        const materialIds: string[] = [];

        // Extract material IDs
        searchData.data.materials.forEach((material: TiktokMaterial) => {
          if (material.id) {
            materialIds.push(material.id);
          }
        });

        // Log the number of materials found
        this.logger.log(
          `Found ${materialIds.length} materials in API response`,
        );

        // Now process each material to get the full details
        if (materialIds.length > 0) {
          // await this.processMaterialDetails(context, materialIds, headers);
        }

        // Update pagination state
        // context.state.currentPage++;

        // Check if there are more results to fetch (based on API response)
        context.state.hasMoreResults = !!searchData.data.pagination.has_more;

        return true;
      } else {
        this.logger.warn(`No materials found in API response`);
        context.state.hasMoreResults = false;
        return true;
      }
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  // /**
  //  * Process material details by fetching each material
  //  */
  // private async processMaterialDetails(
  //   context: TiktokScraperContext,
  //   materialIds: string[],
  //   headers: Record<string, string>,
  // ): Promise<void> {
  //   // Use the detail endpoint for fetching material data
  //   const baseDetailUrl =
  //     'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/detail';

  //   this.logger.log(`Processing ${materialIds.length} materials`);

  //   // Process each material ID sequentially to avoid rate limiting
  //   for (const [index, materialId] of materialIds.entries()) {
  //     try {
  //       this.logger.debug(
  //         `Processing material ${index + 1}/${materialIds.length}: ${materialId}`,
  //       );

  //       // Create URL with material_id parameter
  //       const url = new URL(baseDetailUrl);
  //       url.searchParams.set('material_id', materialId);

  //       // Make the request for material details
  //       const response = await axios.get(url.toString(), { headers });

  //       // Extract ad data from response
  //       if (response.data?.data) {
  //         const adData = this.mapResponseToAdData(
  //           materialId,
  //           response.data.data,
  //         );

  //         // Add to collected ads
  //         context.state.adsCollected.push(adData);

  //         this.logger.debug(`Successfully processed material ${materialId}`);
  //       }

  //       // Add a small delay between requests to prevent rate limiting
  //       await new Promise((resolve) => setTimeout(resolve, 500));
  //     } catch (error) {
  //       this.logger.error(`Error processing material ${materialId}:`, error);

  //       // Add the error to context but continue processing other materials
  //       context.state.errors.push(
  //         error instanceof Error ? error : new Error(String(error)),
  //       );
  //     }
  //   }

  //   this.logger.log(
  //     `Completed processing ${materialIds.length} materials. Total ads collected: ${context.state.adsCollected.length}`,
  //   );
  // }

  // /**
  //  * Map the TikTok API response to our AdData format
  //  */
  // private mapResponseToAdData(materialId: string, data: any): TiktokMaterial {
  //   // Extract relevant fields from the API response
  //   return {
  //     id: materialId,
  //     ad_title: data.ad_title || '',
  //     brand_name: data.brand_name || '',
  //     cost: data.cost || 0,
  //     ctr: data.ctr || 0,
  //     favorite: data.favorite || false,
  //     industry_key: data.industry_key || '',
  //     is_search: data.is_search || false,
  //     like: data.like || 0,
  //     objective_key: data.objective_key || '',
  //     tag: data.tag || undefined,
  //     video_info: {
  //       vid: data.video_info?.vid || '',
  //       duration: data.video_info?.duration || 0,
  //       cover: data.video_info?.cover || '',
  //       video_url: data.video_info?.video_url || {},
  //       width: data.video_info?.width || 0,
  //       height: data.video_info?.height || 0,
  //     },
  //   };
  // }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    // This step should only execute if we have API configuration
    return await Promise.resolve(!!context.state.apiConfig);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cleanup(context: TiktokScraperContext): Promise<void> {
    // No cleanup needed
  }

  getName(): string {
    return this.name;
  }
}
