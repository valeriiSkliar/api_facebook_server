import { RequestStatus } from '@src/api/requests/request-manager-service';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @IsOptional()
  result?: any;
}
