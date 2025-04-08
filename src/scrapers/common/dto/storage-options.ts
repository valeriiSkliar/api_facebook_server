import { IsBoolean } from 'class-validator';

import { IsOptional } from 'class-validator';

import { IsString } from 'class-validator';

export class StorageOptionsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  outputPath?: string;
}
