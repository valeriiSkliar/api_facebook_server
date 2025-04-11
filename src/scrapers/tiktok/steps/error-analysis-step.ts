import { ErrorReportingService } from '@src/core/reporting/services/error-reporting-service';

import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { ActionRecommendation } from '@src/core/api/models/action-recommendation';
import { AbstractGenericScraperStep } from '@src/scrapers/common/interfaces/abstract-generic-scraper-step';
import { Logger } from '@nestjs/common';
import { ApiResponseAnalysis } from '@src/core/api/models/api-response-analysis';

export class ErrorAnalysisStep extends AbstractGenericScraperStep<TiktokScraperContext> {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly errorReportingService: ErrorReportingService,
    private readonly apiResponseAnalyzer: ApiResponseAnalyzer,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    // Get accumulated errors from context
    const apiErrors = context.state.apiErrors || [];
    if (apiErrors.length === 0) {
      this.logger.log('No errors to analyze');
      return true;
    }
    // Analyze errors
    const analysisResults = await this.analyzeErrors(context);

    await this.errorReportingService.saveErrors(analysisResults);

    // Log error statistics
    this.logger.log(`Analyzed and saved ${analysisResults.length} API errors`);
    
    // Generate error frequency report
    const errorFrequency = this.getErrorFrequency(analysisResults);
    this.logger.log('Error frequency by type:', errorFrequency);

    return true;
  }

  private async analyzeErrors(
    context: TiktokScraperContext,
  ): Promise<ApiResponseAnalysis[]> {
    // Analyze errors
    return Promise.all(
      context.state.apiErrors.map((error) =>
        this.apiResponseAnalyzer.analyzeResponse(
          error.materialId,
          error.error,
          error.endpoint,
          error.timestamp || new Date(), // Provide a default timestamp if missing
        ),
      ),
    );
  }

  private getErrorFrequency(analysisResults: ApiResponseAnalysis[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    
    for (const result of analysisResults) {
      if (!frequency[result.errorType]) {
        frequency[result.errorType] = 0;
      }
      frequency[result.errorType]++;
    }
    
    return frequency;
  }
}