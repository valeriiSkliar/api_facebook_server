import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Get,
  Logger,
} from '@nestjs/common';
import { FacebookAdScraperService } from '../services/FacebookAdScraperService';
import { SearchParameterService } from '../services/SearchParameterService';
import { ScraperRequestDto, ScraperResponseDto } from '@src/dto';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly scraperService: FacebookAdScraperService,
    private readonly searchParameterService: SearchParameterService,
  ) {}

  @Get()
  async getStatus(): Promise<{ status: string }> {
    return new Promise((resolve) => {
      resolve({ status: 'ok' });
    });
  }

  @Post('facebook-ads')
  async scrapeFacebookAds(
    @Body() dto: ScraperRequestDto,
  ): Promise<ScraperResponseDto> {
    this.logger.log(
      `Received scraping request for query: ${dto.query.queryString}`,
    );

    // Validate and build the query
    const query = this.searchParameterService.buildQuery(dto.query);
    const validation = this.searchParameterService.validateQuery(query);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid scraper query',
        errors: validation.errors,
      });
    }

    // Run the scraper
    const result = await this.scraperService.scrapeAds(query, dto.options);

    // Transform the result to response DTO
    return {
      success: result.success,
      totalAds: result.totalCount,
      executionTime: result.executionTime,
      outputPath: result.outputPath,
      errors: result.errors.map((e) => e.message),
      ads: result.includeAdsInResponse ? result.ads : undefined,
    };
  }
}
