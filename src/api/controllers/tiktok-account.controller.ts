/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TiktokAccountService } from '../accounts/tiktok-account/tiktok-account.service';
import { CreateTiktokAccountDto } from '../accounts/tiktok-account/dto/create-tiktok-account.dto';
import { UpdateTiktokAccountDto } from '../accounts/tiktok-account/dto/update-tiktok-account.dto';

@Controller('tiktok-account')
export class TiktokAccountController {
  constructor(private readonly tiktokAccountService: TiktokAccountService) {}

  @Post()
  create(@Body() createTiktokAccountDto: CreateTiktokAccountDto) {
    return this.tiktokAccountService.create(createTiktokAccountDto);
  }

  @Get()
  findAll() {
    return this.tiktokAccountService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tiktokAccountService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTiktokAccountDto: UpdateTiktokAccountDto,
  ) {
    return this.tiktokAccountService.update(+id, updateTiktokAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tiktokAccountService.remove(+id);
  }
}
