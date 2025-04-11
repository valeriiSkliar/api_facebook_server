import { ApiResponseAnalysis } from '@src/core/api/models/api-response-analysis';

export class ErrorStorage {
  private static instance: ErrorStorage;
  private errors: ApiResponseAnalysis[] = [];

  private constructor() {}

  public static getInstance(): ErrorStorage {
    if (!ErrorStorage.instance) {
      ErrorStorage.instance = new ErrorStorage();
    }
    return ErrorStorage.instance;
  }

  addError(analysis: ApiResponseAnalysis): void {
    this.errors.push(analysis);
  }

  getErrors(): ApiResponseAnalysis[] {
    return this.errors;
  }

  clear(): void {
    this.errors = [];
  }
}
