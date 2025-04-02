/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ImapFlow,
  ImapFlowOptions,
  FetchMessageObject,
  FetchQueryObject,
  MailboxObject,
} from 'imapflow';
import { PrismaClient } from '@prisma/client';

import { Log } from 'crawlee';
import { Env } from '@lib/Env';

import { EmailVerificationCodeType, IEmailService } from '@src/interfaces';
import { extractVerificationCode } from '@src/common/utiles/verificationCodeExtractor';
import { EmailAccount, EmailConnectionDetails } from '@src/models';

export class EmailService implements IEmailService {
  private prisma: PrismaClient;
  private logger: Log;
  private imapConfig: ImapFlowOptions;

  constructor(prisma: PrismaClient, logger: Log, emailAccount: EmailAccount) {
    this.prisma = prisma;
    this.logger = logger;
    this.logger.info('Creating email service instance', {
      emailAccount: emailAccount,
    });

    const connectionDetails =
      emailAccount.connection_details as EmailConnectionDetails;

    // Log the configuration we're about to use
    this.logger.info('IMAP Configuration:', {
      host: connectionDetails?.imap_host || Env.UKR_NET_IMAP_HOST,
      port: connectionDetails?.imap_port || 993,
      email: emailAccount.email_address,
    });

    this.imapConfig = {
      host: connectionDetails?.imap_host || Env.UKR_NET_IMAP_HOST,
      port: connectionDetails?.imap_port || 993,
      secure: true,
      auth: {
        user: emailAccount.email_address,
        pass: Env.UKR_NET_APP_PASSWORD,
      },
      logger: false,
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    };
  }

  private getImapClient(): ImapFlow {
    return new ImapFlow(this.imapConfig);
  }

  async getLatestVerificationCode(
    emailId: number,
    tiktokAccountId: number,
  ): Promise<EmailVerificationCodeType | null> {
    const client = this.getImapClient();
    const senderEmail = 'creativecenter@tiktok-for-business.com';
    let latestMessage: FetchMessageObject | null = null;
    let latestDate = new Date(0);

    try {
      await client.connect();
      this.logger.info('Connected to IMAP server');

      const lock = await client.getMailboxLock('INBOX');
      try {
        const fetchQuery: FetchQueryObject = {
          envelope: true,
          source: true,
          uid: true,
        };

        for await (const message of client.fetch('1:*', fetchQuery)) {
          if (
            message.envelope?.from?.[0]?.address?.toLowerCase() ===
            senderEmail.toLowerCase()
          ) {
            const messageDate = new Date(message.envelope.date);
            if (messageDate > latestDate) {
              latestDate = messageDate;
              latestMessage = message;
            }
          }
        }
      } finally {
        lock.release();
      }

      if (latestMessage && latestMessage.source) {
        const emailBody = latestMessage.source.toString();
        const code = extractVerificationCode(emailBody);

        if (code) {
          const savedCode = await this.prisma.verificationCode.create({
            data: {
              code,
              message_id: latestMessage.uid.toString(),
              sender_email: senderEmail,
              received_at: latestDate,
              email_body: emailBody,
              status: 'UNUSED',
              email_id: emailId,
              tiktok_account_id: tiktokAccountId,
            },
          });

          return savedCode;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error retrieving verification code:', error);
      throw error;
    } finally {
      await client.logout();
    }
  }

  async waitForVerificationCode(
    email: string,
    timeoutMs = 60000,
    pollIntervalMs = 5000,
  ): Promise<string | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // First get the email record
        const emailRecord = await this.prisma.email.findFirst({
          where: { email_address: email },
          include: {
            tiktok_account: true,
          },
        });

        if (!emailRecord) {
          // Create email record if it doesn't exist
          const newEmailRecord = await this.prisma.email.create({
            data: {
              email_address: email,
              provider: 'ukr.net',
              username: Env.UKR_NET_EMAIL,
              password: Env.UKR_NET_APP_PASSWORD,
              status: 'ACTIVE',
              connection_details: {
                host: this.imapConfig.host,
                port: this.imapConfig.port,
                secure: this.imapConfig.secure,
                auth: {
                  user: this.imapConfig.auth.user,
                  pass: this.imapConfig.auth.pass,
                },
                tls: {
                  rejectUnauthorized:
                    this.imapConfig.tls &&
                    typeof this.imapConfig.tls === 'object' &&
                    'rejectUnauthorized' in this.imapConfig.tls
                      ? (this.imapConfig.tls as { rejectUnauthorized: boolean })
                          .rejectUnauthorized
                      : true,
                },
              },
            },
          });

          // Create TikTok account if needed
          const tiktokAccount = await this.prisma.tikTokAccount.create({
            data: {
              email_id: newEmailRecord.id,
              status: 'ACTIVE',
              username: `tiktok_${newEmailRecord.email_address}`,
              password: 'temp_password', // This should be replaced with actual password
              is_active: true,
              verification_required: true,
            },
          });

          const verificationCode = await this.getLatestVerificationCode(
            newEmailRecord.id,
            tiktokAccount.id,
          );

          if (verificationCode && verificationCode.status === 'UNUSED') {
            return verificationCode.code;
          }
        } else {
          // Get or create TikTok account
          let tiktokAccount = emailRecord.tiktok_account[0];

          if (!tiktokAccount) {
            tiktokAccount = await this.prisma.tikTokAccount.create({
              data: {
                email_id: emailRecord.id,
                status: 'ACTIVE',
                username: `tiktok_${emailRecord.email_address}`,
                password: 'temp_password', // This should be replaced with actual password
                is_active: true,
                verification_required: true,
              },
            });
          }

          const verificationCode = await this.getLatestVerificationCode(
            emailRecord.id,
            tiktokAccount.id,
          );

          if (verificationCode && verificationCode.status === 'UNUSED') {
            return verificationCode.code;
          }
        }
      } catch (error) {
        this.logger.error('Error while polling for verification code:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  async markCodeAsUsed(code: string): Promise<EmailVerificationCodeType> {
    const result = await this.prisma.verificationCode.findFirst({
      where: { code },
    });

    if (!result) {
      throw new Error(`Verification code ${code} not found`);
    }

    return await this.prisma.verificationCode.update({
      where: {
        id: result.id,
      },
      data: {
        status: 'USED',
        used_at: new Date(),
      },
    });
  }

  async getCodeStatus(code: string): Promise<EmailVerificationCodeType | null> {
    return await this.prisma.verificationCode.findFirst({
      where: { code },
    });
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    const client = this.getImapClient();

    try {
      this.logger.info('Testing connection to IMAP server...', {
        host: this.imapConfig.host,
        user: this.imapConfig.auth.user,
      });

      await client.connect();

      const lock = await client.getMailboxLock('INBOX');
      try {
        const mailbox = client.mailbox as MailboxObject | null;

        return {
          success: true,
          message: 'Successfully connected to email server',
          details: {
            host: this.imapConfig.host,
            user: this.imapConfig.auth.user,
            mailbox: mailbox
              ? {
                  path: mailbox.path,
                  exists: mailbox.exists,
                  total: mailbox.exists,
                }
              : 'No mailbox information available',
          },
        };
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error('Failed to connect to email server', {
        error,
        config: {
          host: this.imapConfig.host,
          user: this.imapConfig.auth.user,
        },
      });
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to connect to email server',
        details: {
          host: this.imapConfig.host,
          user: this.imapConfig.auth.user,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    } finally {
      try {
        await client.logout();
      } catch (error) {
        this.logger.info('Error during logout', { error });
      }
    }
  }
}
