/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/database';
import { CreateTiktokAccountDto } from './dto/create-tiktok-account.dto';
import { UpdateTiktokAccountDto } from './dto/update-tiktok-account.dto';
import { TikTokAccount } from '@prisma/client';

@Injectable()
export class TiktokAccountService {
  constructor(private prisma: PrismaService) {}

  async create(
    createTiktokAccountDto: CreateTiktokAccountDto,
  ): Promise<TikTokAccount> {
    const { emailAccountId, ...accountData } = createTiktokAccountDto;

    return await this.prisma.tikTokAccount.create({
      data: {
        username: accountData.username,
        password: accountData.password,
        status: accountData.status,
        notes: accountData.notes ?? null,
        verification_required: accountData.verificationRequired ?? false,
        is_active: accountData.isActive ?? true,
        email_account: {
          connect: { id: emailAccountId },
        },
      },
      include: {
        email_account: true,
      },
    });
  }

  async findAll(): Promise<TikTokAccount[]> {
    return await this.prisma.tikTokAccount.findMany({
      include: {
        email_account: true,
      },
    });
  }

  async findOne(id: number): Promise<TikTokAccount | null> {
    return await this.prisma.tikTokAccount.findUnique({
      where: { id },
      include: {
        email_account: true,
      },
    });
  }

  async update(
    id: number,
    updateTiktokAccountDto: UpdateTiktokAccountDto,
  ): Promise<TikTokAccount> {
    const { emailAccountId, ...accountData } = updateTiktokAccountDto;

    // Convert snake_case field names to camelCase if they exist
    const updateData: Partial<{
      username: string;
      password: string;
      status: string;
      notes: string | null;
      verification_required: boolean;
      is_active: boolean;
      email_account?: { connect: { id: number } };
    }> = {};

    if ('username' in accountData) updateData.username = accountData.username;
    if ('password' in accountData) updateData.password = accountData.password;
    if ('status' in accountData) updateData.status = accountData.status;
    if ('notes' in accountData) updateData.notes = accountData.notes ?? null;
    if ('verificationRequired' in accountData) {
      updateData.verification_required = accountData.verificationRequired;
    }
    if ('isActive' in accountData) {
      updateData.is_active = accountData.isActive;
    }

    // Only update email_account if emailAccountId is provided
    if (emailAccountId) {
      updateData.email_account = {
        connect: { id: emailAccountId },
      };
    }

    return await this.prisma.tikTokAccount.update({
      where: { id },
      data: updateData,
      include: {
        email_account: true,
      },
    });
  }

  async remove(id: number): Promise<TikTokAccount> {
    return await this.prisma.tikTokAccount.delete({
      where: { id },
      include: {
        email_account: true,
      },
    });
  }
}
