import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperContext } from '../../tiktok-scraper-types';
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
      // Update to store empty array rather than failing
      state.materialsIds = [];
      return true;
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

      this.logger.log(
        `Filtered ${existingMaterialIds.size} existing materials, ${state.materialsIds.length} new materials remain`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to filter materials:', error);
      // Store the error in the state for diagnostic purposes
      if (!state.apiErrors) {
        state.apiErrors = [];
      }
      state.apiErrors.push({
        materialId: 'filter_step',
        error: error,
        endpoint: 'database_query',
        timestamp: new Date(),
      });

      // Initialize to empty array to allow pipeline to continue
      state.materialsIds = [];
      return true;
    }
  }
}
