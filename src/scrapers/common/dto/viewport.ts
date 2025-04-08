import { Min } from 'class-validator';

import { IsNumber } from 'class-validator';

export class ViewportDto {
  @IsNumber()
  @Min(200)
  width: number;

  @IsNumber()
  @Min(200)
  height: number;
}
