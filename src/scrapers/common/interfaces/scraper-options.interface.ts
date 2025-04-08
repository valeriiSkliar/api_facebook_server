import {
  BehaviorOptionsDto,
  BrowserOptionsDto,
  NetworkOptionsDto,
  StorageOptionsDto,
} from '@src/api/facebook/dto';

export interface ScraperOptions<T> {
  storage?: StorageOptionsDto;
  includeAdsInResponse?: boolean;
  browser?: BrowserOptionsDto;
  network?: NetworkOptionsDto;
  behavior?: BehaviorOptionsDto;
  query?: T;
}
