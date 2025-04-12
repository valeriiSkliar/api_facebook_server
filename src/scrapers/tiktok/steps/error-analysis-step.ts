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
    
    // Log detailed information about apiErrors to diagnose issues
    this.logger.log(`Found ${apiErrors.length} API errors to analyze`);
    
    if (apiErrors.length > 0) {
      // Log a sample of the first error to help diagnose structure issues
      this.logger.debug(`Sample error: ${JSON.stringify({
        materialId: apiErrors[0].materialId,
        endpoint: apiErrors[0].endpoint,
        timestamp: apiErrors[0].timestamp,
        error: apiErrors[0].error ? apiErrors[0].error.message : 'No error message'
      })}`);
    }
    
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
        
        // Log some sample analysis results to help diagnose issues
        if (analysisResults.length > 0) {
          const sample = analysisResults[0];
          this.logger.debug(`Sample analysis result to be saved:`, {
            materialId: sample.materialId,
            endpoint: sample.endpoint,
            errorType: sample.errorType,
            errorMessage: sample.errorMessage ? sample.errorMessage.substring(0, 100) : 'None',
            statusCode: sample.statusCode
          });
        }

        try {
          await this.errorReportingService.saveErrors(analysisResults);
          this.logger.log(
            `Successfully saved ${analysisResults.length} API errors to database`,
          );
        } catch (saveError) {
          this.logger.error(`Failed to save errors to database:`, saveError);
          this.logger.debug(`Details of save error:`, saveError instanceof Error ? 
            { message: saveError.message, stack: saveError.stack } : saveError);
          // Continue execution even if saving fails
        }
      } else {
        this.logger.warn('No valid API error analysis results to save');
        
        // Additional logging to help diagnose why no results were produced
        if (context.state.apiErrors && context.state.apiErrors.length > 0) {
          this.logger.debug(`${context.state.apiErrors.length} API errors exist in context but no valid analysis results were generated`);
        }
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
