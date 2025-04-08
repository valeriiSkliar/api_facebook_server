/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { IScraper } from '../common/interfaces';
import { ScraperResult } from '../facebook/models/facebook-scraper-result';
import { RequestMetadata } from '@src/api/requests/request-manager-service';

@Injectable()
export class TiktokApiScraper implements IScraper {
  private readonly logger = new Logger(TiktokApiScraper.name);

  constructor(private readonly httpService: HttpService) {}

  async scrape(request: RequestMetadata): Promise<ScraperResult> {
    const startTime = Date.now();

    throw new Error('Not implemented');
    // const { url } = request.parameters; // Пример извлечения параметра
    const url = request.parameters.query?.queryString;

    if (!url) {
      this.logger.error('Missing URL parameter for scraping');
      return {
        success: false,
        errors: [new Error('Missing URL parameter for scraping')],
        ads: [],
        totalCount: 0,
        executionTime: 0,
      };
    }

    this.logger.log(`Scraping TikTok API for URL: ${url}`);

    try {
      // TODO: Заменить на реальный URL и логику API TikTok
      // Это пример, реальный API TikTok может потребовать аутентификации,
      // специфичных заголовков и структуры запроса/ответа.
      const apiUrl = `https://api.example-tiktok.com/getData?url`;
      const response = await firstValueFrom(this.httpService.get(apiUrl));

      // TODO: Обработать ответ API и преобразовать в ScraperResult
      const videoData = response.data; // Предполагаемая структура ответа

      if (!videoData || !videoData.id) {
        this.logger.warn(`No valid data found in API response for URL: ${url}`);
        return {
          success: false,
          errors: [new Error('No valid data found in API response')],
          ads: [],
          totalCount: 0,
          executionTime: 0,
        };
      }

      const result: ScraperResult = {
        success: true,
        ads: [],
        errors: [],
        totalCount: 1,
        executionTime: Date.now() - startTime,
      };

      this.logger.log(`Successfully scraped data for URL: ${url}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error scraping TikTok API for URL ${url}: ${error.message}`,
      );

      let errorMessage = 'Unknown error during API scraping';
      if (error instanceof AxiosError) {
        errorMessage = `API request failed: ${error.response?.statusText || error.message}`;
        if (error.response?.data) {
          errorMessage += ` - ${JSON.stringify(error.response.data)}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        errors: [new Error(errorMessage)],
        ads: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
