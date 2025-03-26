import { Logger } from '@nestjs/common';
import { AbstractFilterStep } from '@src/interfaces/AbstractFilterStep';

export class FilterRegistry {
  private static instance: FilterRegistry;
  private filters: Map<string, new (logger: Logger) => AbstractFilterStep> =
    new Map();

  static getInstance(): FilterRegistry {
    if (!FilterRegistry.instance) {
      FilterRegistry.instance = new FilterRegistry();
    }
    return FilterRegistry.instance;
  }

  registerFilter(
    filterType: string,
    filterClass: new (logger: Logger) => AbstractFilterStep,
  ): void {
    this.filters.set(filterType, filterClass);
  }

  getFilter(filterType: string, logger: Logger): AbstractFilterStep | null {
    const FilterClass = this.filters.get(filterType);
    if (!FilterClass) return null;
    return new FilterClass(logger);
  }

  getAvailableFilters(): string[] {
    return Array.from(this.filters.keys());
  }
}
