import { ErrorReportingService } from '@src/core/reporting/services/error-reporting-service';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { TiktokScraperContext } from '../tiktok-scraper-types';
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

    try {
      // Analyze errors
      const analysisResults = await this.analyzeErrors(context);

      if (analysisResults.length > 0) {
        // Log before saving to help with debugging
        this.logger.log(
          `Attempting to save ${analysisResults.length} API errors to database`,
        );

        try {
          await this.errorReportingService.saveErrors(analysisResults);
          this.logger.log(
            `Successfully saved ${analysisResults.length} API errors to database`,
          );
        } catch (saveError) {
          this.logger.error(`Failed to save errors to database:`, saveError);
          // Continue execution even if saving fails
        }
      } else {
        this.logger.warn('No valid API error analysis results to save');
      }

      // Generate error frequency report
      const errorFrequency = this.getErrorFrequency(analysisResults);
      this.logger.log('Error frequency by type:', errorFrequency);

      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      // Don't fail the pipeline because of error analysis issues
      return true;
    }
  }

  private async analyzeErrors(
    context: TiktokScraperContext,
  ): Promise<ApiResponseAnalysis[]> {
    // Analyze errors
    const analysisResults: ApiResponseAnalysis[] = [];

    for (const error of context.state.apiErrors) {
      try {
        const analysis = this.apiResponseAnalyzer.analyzeResponse(
          error.materialId || '',
          error.error,
          error.endpoint,
          error.timestamp || new Date(), // Provide a default timestamp if missing
        );

        // Ensure all required fields are present
        if (!analysis.requestUrl) {
          analysis.requestUrl = error.endpoint;
        }

        analysisResults.push(analysis);
      } catch (analysisError) {
        this.logger.error(`Error analyzing API error:`, analysisError);
        // Continue with other errors
      }
    }

    return await Promise.all(analysisResults);
  }

  private getErrorFrequency(
    analysisResults: ApiResponseAnalysis[],
  ): Record<string, number> {
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
