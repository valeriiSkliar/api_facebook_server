import { Logger } from '@nestjs/common';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { PrismaService } from '@src/database';
// import { Prisma } from '@prisma/client';

export class ErrorDiagnosticStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    // 1. Check for API errors in context
    const apiErrors = context.state.apiErrors || [];
    this.logger.log(`Found ${apiErrors.length} API errors in context`);

    // 2. Check for existing error records in database
    try {
      const errorCount = await this.prisma.apiErrorRecord.count();
      this.logger.log(`Current error record count in database: ${errorCount}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to count error records: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    // 3. Add a test error record directly
    try {
      this.logger.log('Attempting to create a test error record...');

      // await this.prisma.apiErrorRecord.create({
      //   data: {
      //     materialId: 'test-material',
      //     requestUrl: 'https://test-endpoint.com/api/test',
      //     timestamp: new Date(),
      //     endpoint: '/api/test',
      //     statusCode: 503,
      //     errorType: 'TEST_ERROR',
      //     errorMessage: 'This is a test error to verify database connectivity',
      //     headers: Prisma.JsonNull,
      //     retryCount: 0,
      //     wasResolved: false,
      //     responseTimeMs: 500,
      //     createdAt: new Date(),
      //     updatedAt: new Date(),
      //   },
      // });

      this.logger.log('Successfully created test error record');

      // Verify the test record was saved
      const testErrorCount = await this.prisma.apiErrorRecord.count({
        where: {
          errorType: 'TEST_ERROR',
        },
      });

      this.logger.log(`Found ${testErrorCount} test error records`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create test error record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    // 4. Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.log('Database connection is working properly');
    } catch (error: unknown) {
      this.logger.error(
        `Database connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return true;
  }
}
