import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@src/database';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';

@Injectable()
export class EmailAccountService {
  constructor(private prisma: PrismaService) {}

  create(createEmailAccountDto: CreateEmailAccountDto) {
    // Если imap_password не указан, используем обычный password
    const imap_password =
      createEmailAccountDto.imap_password || createEmailAccountDto.password;

    return this.prisma.email.create({
      data: {
        ...createEmailAccountDto,
        imap_password, // Добавляем поле imap_password
      },
    });
  }

  findAll() {
    return this.prisma.email.findMany({
      include: {
        tiktok_account: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.email.findUnique({
      where: { id },
      include: {
        tiktok_account: true,
      },
    });
  }

  update(id: number, updateEmailAccountDto: UpdateEmailAccountDto) {
    // Подготавливаем данные для обновления
    const updateData: UpdateEmailAccountDto = { ...updateEmailAccountDto };

    // Проверяем наличие imap_password
    if (!updateData.imap_password && !updateData.password) {
      throw new BadRequestException('imap_password is required');
    }

    // Если нет imap_password, но есть password, используем password как значение для imap_password
    if (!updateData.imap_password && updateData.password) {
      updateData.imap_password = updateData.password;
    }

    return this.prisma.email.update({
      where: { id },
      data: updateData,
    });
  }

  remove(id: number) {
    return this.prisma.email.delete({
      where: { id },
    });
  }
}
