import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../../tiktok-scraper-types';

@Injectable()
export class PaginationStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (!context.state.rawApiResponse) {
      this.logger.warn('No API response data available for pagination');
      return Promise.resolve(true);
    }

    const { data } = context.state.rawApiResponse;

    if (!data || !data.pagination) {
      this.logger.warn('No pagination data found in API response');
      context.state.hasMoreResults = false;
      return Promise.resolve(true);
    }

    const { pagination } = data;

    // Update context with pagination information
    context.state.hasMoreResults = pagination.has_more;
    context.state.currentPage = pagination.page;

    // Log pagination status
    this.logger.log(
      `Pagination info: page ${pagination.page}, size ${pagination.size}, total ${pagination.total_count}, has more: ${pagination.has_more}`,
    );

    // If we have more results and haven't exceeded maximum pages, increment page counter for next request
    const maxPages = context.options.behavior?.maxPages || 10;

    if (pagination.has_more && context.state.currentPage < maxPages) {
      // Increment the current page for the next API request
      context.state.currentPage = pagination.page;
      this.logger.log(
        `More results available. Will proceed to page ${context.state.currentPage + 1}`,
      );
    } else {
      if (context.state.currentPage >= maxPages) {
        this.logger.log(
          `Reached maximum page limit (${maxPages}). Stopping pagination.`,
        );
      } else {
        this.logger.log('No more results available. Pagination complete.');
      }
      context.state.hasMoreResults = false;
    }

    // Return true to indicate successful execution
    return Promise.resolve(true);
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    // This step should execute after we have API response data
    return Promise.resolve(!!context.state.rawApiResponse);
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}
