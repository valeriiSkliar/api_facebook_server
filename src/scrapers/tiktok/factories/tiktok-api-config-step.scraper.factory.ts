import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database';
// import { TiktokApiConfigStep } from '../pipelines/api-config/steps/tiktok-api-config-step';

@Injectable()
export class TiktokApiConfigStepFactory {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // createInitializationStep(): TiktokApiConfigStep {
  //   return new TiktokApiConfigStep(
  //     'InitializationStep',
  //     this.logger,
  //     this.stateStorage,
  //   );
  // }
}
