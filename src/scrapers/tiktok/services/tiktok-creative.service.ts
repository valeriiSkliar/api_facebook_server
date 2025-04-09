import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { Prisma, DetailMaterial } from '@prisma/client';

@Injectable()
export class TiktokCreativeService {
  private readonly logger = new Logger(TiktokCreativeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveCreatives(adsData: DetailMaterial[]): Promise<void> {
    this.logger.log(`Attempting to save ${adsData.length} creatives.`);
    const createPromises: Prisma.PrismaPromise<DetailMaterial>[] = [];

    for (const adData of adsData) {
      const videoUrl = adData.video_info.video_url_720p ?? '';

      const detailMaterialData: Omit<
        Prisma.DetailMaterialCreateInput,
        'countryCodes' | 'keywords' | 'objectives' | 'patterns' | 'videoInfo'
      > = {
        id: adData.id,
        adTitle: adData.ad_title ?? '',
        brandName: adData.brand_name ?? '',
        comment: adData.comment ?? 0,
        cost: adData.cost ?? 0,
        ctr: adData.ctr ?? 0,
        favorite: adData.favorite ?? false,
        hasSummary: adData.has_summary ?? false,
        highlightText: adData.highlight_text ?? '',
        industryKey: adData.industry_key ?? '',
        isSearch: adData.is_search ?? false,
        landingPage: adData.landing_page ?? '',
        like: adData.like ?? 0,
        objectiveKey: adData.objective_key ?? '',
        share: adData.share ?? 0,
        source: 'tiktok',
        sourceKey: 0,
        tag: adData.tag ?? 0,
        voiceOver: false,
      };

      const videoInfoData: Prisma.VideoInfoCreateWithoutDetailMaterialInput = {
        vid: adData.video_info.vid,
        cover: adData.video_info.cover,
        duration: adData.video_info.duration,
        height: adData.video_info.height,
        width: adData.video_info.width,
        videoUrl720p: videoUrl,
      };

      createPromises.push(
        this.prisma.detailMaterial.upsert({
          where: { id: adData.id },
          create: {
            ...detailMaterialData,
            videoInfo: {
              create: videoInfoData,
            },
            countryCodes: { create: [] },
            keywords: { create: [] },
            objectives: { create: [] },
            patterns: { create: [] },
          },
          update: {
            ...detailMaterialData,
            videoInfo: {
              update: {
                where: { detailMaterialId: adData.id },
                data: videoInfoData,
              },
            },
          },
        }),
      );
    }

    try {
      const results = await this.prisma.$transaction(createPromises);
      this.logger.log(
        `Successfully saved or updated ${results.length} creatives.`,
      );
    } catch (error) {
      const prismaError = error as Error;
      this.logger.error(
        'Error saving creatives to database',
        prismaError.stack,
      );
      // Consider re-throwing or handling the error appropriately
    }
  }
}
