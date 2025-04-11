import { Module } from '@nestjs/common';
import { ApiResponseAnalyzer } from './base-api-response-analyzer';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';

@Module({
  providers: [
    {
      provide: ApiResponseAnalyzer,
      useFactory: () => {
        const errorStorage = ErrorStorage.getInstance();
        return new ApiResponseAnalyzer(errorStorage);
      },
    },
  ],
  exports: [ApiResponseAnalyzer],
})
export class ApiAnalyzerModule {}
