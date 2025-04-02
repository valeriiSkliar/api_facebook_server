import { AdDataDto } from './AdDataDto'; // Используем существующий AdDataDto
import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';

class RequestInfo {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsString() // Или IsEnum(RequestStatus) если RequestStatus экспортируется
  status: string;

  @IsDate()
  createdAt: Date;

  @IsOptional()
  @IsDate()
  processedAt: Date | null;

  @IsOptional()
  @IsString()
  outputPath?: string | null;
}

export class GetRequestResponseDto {
  @IsBoolean()
  success: boolean;

  @ValidateNested()
  @Type(() => RequestInfo)
  request: RequestInfo;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdDataDto) // Убедитесь, что AdDataDto валидирует AdData
  results?: AdDataDto[] | null;

  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error?: null | unknown; // Тип ошибки может быть разным
}
