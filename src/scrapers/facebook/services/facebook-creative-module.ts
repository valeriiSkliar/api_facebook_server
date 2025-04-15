import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/database';
import { FacebookCreativeService } from './facebook-creative-service';
import { Logger } from '@nestjs/common';

@Module({
  imports: [PrismaModule],
  providers: [Logger, FacebookCreativeService],
  exports: [FacebookCreativeService],
})
export class FacebookCreativeModule {}
