import { Module } from '@nestjs/common';
import { BrowserPoolModule } from './browser/browser-pool';

@Module({
  imports: [BrowserPoolModule],
  exports: [BrowserPoolModule],
})
export class CoreModule {}
