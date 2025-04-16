import { Module } from '@nestjs/common';
import { TabManager } from './tab-manager';

@Module({
  providers: [TabManager],
  exports: [TabManager],
})
export class TabManagerModule {}
