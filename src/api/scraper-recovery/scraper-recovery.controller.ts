// src/api/scraper-recovery/scraper-recovery.controller.ts

import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { ScraperRecoveryService } from '@src/scrapers/common/services/scraper-recovery.service';

@Controller('api/scraper-recovery')
export class ScraperRecoveryController {
  private readonly logger = new Logger(ScraperRecoveryController.name);

  constructor(private readonly recoveryService: ScraperRecoveryService) {}

  @Get('stats')
  async getRecoveryStats() {
    return await this.recoveryService.getRecoveryStats();
  }

  @Post('recover/:taskId')
  async recoverTask(@Param('taskId') taskId: string) {
    this.logger.log(`Recovery requested for task: ${taskId}`);
    const success = await this.recoveryService.recoverTaskById(taskId);
    return { success, taskId };
  }

  @Post('process-failed/:taskId')
  async processFailedMaterials(@Param('taskId') taskId: string) {
    this.logger.log(
      `Processing failed materials requested for task: ${taskId}`,
    );
    const processedCount =
      await this.recoveryService.processFailedMaterials(taskId);
    return { success: processedCount > 0, taskId, processedCount };
  }

  @Post('run-recovery')
  async runRecovery() {
    this.logger.log('Manual recovery operation requested');
    await this.recoveryService.recoverIncompleteTasks();
    return { success: true, message: 'Recovery process initiated' };
  }
}
