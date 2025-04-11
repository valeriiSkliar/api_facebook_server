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

    // Получаем накопленные ошибки из контекста
    // const errors = context.state.errors || [];
    const apiErrors = context.state.apiErrors || [];
    if (apiErrors.length === 0) {
      this.logger.log('No errors to analyze');
      return true;
    }
    // Анализируем ошибки
    const analysisResults = await this.analyzeErrors(context);

    await this.errorReportingService.saveErrors(analysisResults);

    // Формируем рекомендации для следующих запусков
    // const recommendations = this.generateRecommendations(
    // analysisResults,
    // context,
    // );

    // Сохраняем статистику и результаты анализа
    // await this.errorReportingService.saveAnalysisResults(
    //   analysisResults,
    //   context.query,
    // );

    // Добавляем рекомендации в контекст для использования в следующих шагах
    // context.state.errorAnalysis = {
    //   results: analysisResults,
    //   recommendations,
    //   errorRate: this.calculateErrorRate(context),
    //   mostCommonErrorType: this.findMostCommonErrorType(analysisResults),
    // };

    // Логируем итоги анализа
    // this.logAnalysisResults(context.state.errorAnalysis);

    return true;
  }

  private async analyzeErrors(
    // apiErrors: ApiResponseAnalysis[],
    context: TiktokScraperContext,
  ): Promise<ApiResponseAnalysis[]> {
    // Анализ ошибок
    return Promise.all(
      context.state.apiErrors.map((error) =>
        this.apiResponseAnalyzer.analyzeResponse(
          error.materialId,
          error.error,
          error.endpoint,
          error.timestamp,
        ),
      ),
    );
  }

  private generateRecommendations(
    analysisResults: ApiResponseAnalysis[],
    context: TiktokScraperContext,
  ): ActionRecommendation[] {
    // Генерация рекомендаций на основе результатов анализа
    return analysisResults
      .map(
        (result) =>
          // this.apiResponseAnalyzer.generateActionRecommendation(result),
          null,
      )
      .filter((rec) => rec !== null);
  }

  // Другие вспомогательные методы...
}
