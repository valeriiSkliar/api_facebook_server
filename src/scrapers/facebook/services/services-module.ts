import { Module } from '@nestjs/common';
import { FacebookCreativeModule } from './facebook-creative-module';

@Module({
  imports: [FacebookCreativeModule],
  exports: [FacebookCreativeModule],
})
export class ServicesModule {}
