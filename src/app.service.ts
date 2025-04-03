import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  description(): string {
    return 'facebook ads and tiktok scraper api';
  }
}
