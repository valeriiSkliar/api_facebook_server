import { PartialType } from '@nestjs/mapped-types';
import { CreateTiktokAccountDto } from './create-tiktok-account.dto';

export class UpdateTiktokAccountDto extends PartialType(
  CreateTiktokAccountDto,
) {}
