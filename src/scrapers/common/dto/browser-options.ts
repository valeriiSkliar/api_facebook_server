import { ViewportDto } from '@src/scrapers/common/dto/viewport';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BrowserOptionsDto {
  @IsOptional()
  @IsBoolean()
  headless?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ViewportDto)
  viewport?: ViewportDto;
}
