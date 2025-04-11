/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseAnalysis } from '@src/core/api/models/api-response-analysis';
import { PrismaService } from '@src/database';
import { Prisma } from '@prisma/client';

@Injectable()
export class ErrorReportingService {
  private readonly logger = new Logger(ErrorReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveErrors(errors: ApiResponseAnalysis[]): Promise<void> {
    for (const error of errors) {
      await this.prisma.apiErrorRecord.create({
        data: {
          materialId: error.materialId,
          requestUrl: error.requestUrl ?? '',
          timestamp: error.timestamp,
          statusCode: error.statusCode,
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          endpoint: error.endpoint,
          headers: error.responseHeaders
            ? JSON.stringify(error.responseHeaders)
            : Prisma.JsonNull,
          //   retryCount: error.recommendation?.maxAttempts || 0,
          wasResolved: error.isSuccess,
        },
      });
    }
    this.logger.log(`Saved ${errors.length} errors to database`);
  }

  async generateReport(): Promise<{ errorType: string; count: number }[]> {
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
  }
}
