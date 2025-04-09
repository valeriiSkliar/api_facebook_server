/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { PrismaService } from '@src/database';
import { DetailMaterial } from '@prisma/client';

type DetailMaterialWithId = Pick<DetailMaterial, 'id'>;

@Injectable()
export class FilterMaterialsStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    const { state } = context;

    if (!state.materialsIds || state.materialsIds.length === 0) {
      this.logger.warn('No material IDs to filter');
      return false;
    }

    try {
      const existingMaterials = (await this.prisma.detailMaterial.findMany({
        where: {
          id: {
            in: state.materialsIds,
          },
        },
        select: {
          id: true,
        },
      })) as DetailMaterialWithId[];

      const existingMaterialIds = new Set<string>(
        existingMaterials.map((m: DetailMaterialWithId): string => m.id),
      );
      state.materialsIds = state.materialsIds.filter(
        (id) => !existingMaterialIds.has(id),
      );

      return true;
    } catch (error) {
      this.logger.error('Failed to filter materials:', error);
      return false;
    }
  }
}
