import { IsOptional } from 'class-validator';

import { Min } from 'class-validator';

import { IsNumber } from 'class-validator';

export class NetworkOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retries?: number;
}
