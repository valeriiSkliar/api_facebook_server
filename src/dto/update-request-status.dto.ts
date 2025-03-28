import { IsEnum, IsOptional } from 'class-validator';
import { RequestStatus } from '../services/request-manager-service';

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @IsOptional()
  result?: any;
}
