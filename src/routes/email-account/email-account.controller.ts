import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
} from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';

@Controller('email-account')
export class EmailAccountController {
  constructor(
    private readonly logger: Logger,
    private readonly emailAccountService: EmailAccountService,
  ) {}

  @Post()
  create(@Body() createEmailAccountDto: CreateEmailAccountDto) {
    this.logger.log('Creating new email account', createEmailAccountDto);
    return this.emailAccountService.create(createEmailAccountDto);
  }

  @Get()
  findAll() {
    this.logger.log('Fetching all email accounts');
    return this.emailAccountService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Fetching email account with id: ${id}`);
    return this.emailAccountService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmailAccountDto: UpdateEmailAccountDto,
  ) {
    this.logger.log(`Updating email account with id: ${id}`);
    return this.emailAccountService.update(+id, updateEmailAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log(`Deleting email account with id: ${id}`);
    return this.emailAccountService.remove(+id);
  }
}
