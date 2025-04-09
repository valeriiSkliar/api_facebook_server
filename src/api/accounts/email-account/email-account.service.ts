import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/database';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';

@Injectable()
export class EmailAccountService {
  constructor(private prisma: PrismaService) {}

  create(createEmailAccountDto: CreateEmailAccountDto) {
    return this.prisma.email.create({
      data: createEmailAccountDto,
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
    return this.prisma.email.update({
      where: { id },
      data: updateEmailAccountDto,
    });
  }

  remove(id: number) {
    return this.prisma.email.delete({
      where: { id },
    });
  }
}
