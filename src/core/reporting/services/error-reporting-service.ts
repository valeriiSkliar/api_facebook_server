import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseAnalysis } from '@src/core/api/models/api-response-analysis';
import { PrismaService } from '@src/database';
import { Prisma } from '@prisma/client';
import { SafeJsonHelper } from 'src/services/common/safe-json-helper';

@Injectable()
export class ErrorReportingService {
  private readonly logger = new Logger(ErrorReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveErrors(errors: ApiResponseAnalysis[]): Promise<void> {
    if (!errors || errors.length === 0) {
      this.logger.warn('No errors to save');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const error of errors) {
      try {
        // Validate and ensure required fields have default values
        const materialId = error.materialId || '';
        const requestUrl = error.requestUrl || error.endpoint || '';
        const timestamp = error.timestamp || new Date();
        const statusCode = error.statusCode || 0;
        const errorType = error.errorType || 'UNKNOWN';
        const errorMessage = error.errorMessage || 'No error message provided';
        const endpoint = error.endpoint || '';

        // Check if headers are valid before converting to JSON
        let headersJson: Prisma.JsonValue | null = null;
        if (
          error.responseHeaders &&
          typeof error.responseHeaders === 'object'
        ) {
          try {
            // Convert headers to JSON-safe format and stringify
            const safeHeaders = SafeJsonHelper.convertDatesToTimestamps(
              error.responseHeaders,
            );
            headersJson = SafeJsonHelper.stringify(safeHeaders);
          } catch (jsonError: unknown) {
            this.logger.warn(
              `Failed to stringify headers: ${
                jsonError instanceof Error ? jsonError.message : 'Unknown error'
              }`,
            );
          }
        }

        // Create the database record with validated data
        await this.prisma.apiErrorRecord.create({
          data: {
            materialId,
            requestUrl,
            timestamp,
            statusCode,
            errorType,
            errorMessage,
            endpoint,
            headers: headersJson ?? Prisma.JsonNull,
            retryCount: 0, // Default value since it's not in the ApiResponseAnalysis
            wasResolved: error.isSuccess || false,
            responseTimeMs: error.responseTime,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        successCount++;
      } catch (dbError: unknown) {
        failureCount++;
        this.logger.error(
          `Failed to save error record for ${error.materialId || 'unknown'}: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
          dbError instanceof Error ? dbError.stack : undefined,
        );
        // Continue with next error instead of failing the entire batch
      }
    }

    this.logger.log(
      `Saved ${successCount} errors to database (${failureCount} failed)`,
    );
  }

  async generateReport(): Promise<{ errorType: string; count: number }[]> {
    try {
      return await this.prisma.apiErrorRecord
        .groupBy({
          by: ['errorType'],
          _count: { errorType: true },
        })
        .then((results) =>
          results.map((r) => ({
            errorType: r.errorType,
            count: r._count.errorType,
          })),
        );
    } catch (error) {
      this.logger.error('Failed to generate error report:', error);
      return [];
    }
  }
}
