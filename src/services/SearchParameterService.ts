import { Injectable } from '@nestjs/common';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';

@Injectable()
export class SearchParameterService {
  validateQuery(query: AdLibraryQuery): { valid: boolean; errors: string[] } {
    // Validate query parameters
    // ...implementation here...
  }

  buildQuery(params: Partial<AdLibraryQuery>): AdLibraryQuery {
    // Build complete query from partial parameters
    // ...implementation here...
  }
}
