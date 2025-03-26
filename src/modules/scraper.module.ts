import { BadRequestException } from '@nestjs/common';

import { Controller, Post, Body } from '@nestjs/common';

import { Logger } from '@nestjs/common';

import { Module } from '@nestjs/common';
import { ScraperFactory } from '@src/implementations/factories/ScraperFactory';
import { StepFactory } from '@src/implementations/factories/StepFactory';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
import { SearchParameterService } from '@src/services/SearchParameterService';

@Module({
  controllers: [ScraperController],
  providers: [
    FacebookAdScraperService,
    SearchParameterService,
    ScraperFactory,
    StepFactory,
    {
      provide: Logger,
      useValue: new Logger('ScraperModule'),
    },
  ],
  exports: [FacebookAdScraperService],
})
export class ScraperModule {}

// controllers/scraper.controller.ts
@Controller('scraper')
export class ScraperController {
  constructor(
    private readonly scraperService: FacebookAdScraperService,
    private readonly searchParameterService: SearchParameterService,
  ) {}

  @Post('facebook-ads')
  async scrapeFacebookAds(
    @Body() dto: ScraperRequestDto,
  ): Promise<ScraperResponseDto> {
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

    return {
      success: result.success,
      totalAds: result.totalCount,
      executionTime: result.executionTime,
      outputPath: result.outputPath,
      ads: result.ads,
      errors: result.errors.map((e) => e.message),
    };
  }
}
