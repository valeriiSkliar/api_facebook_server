// // src/api/accounts/auth/auth.module.ts

// import { Module, Logger } from '@nestjs/common';
// import { AuthController } from './auth.controller';
// import { TikTokAuthService } from '@src/authenticators/tik-tok/tiktok-auth-service';
// import { TikTokAuthenticator } from '@src/authenticators/tik-tok/tik-tok-authenticator';
// import { TikTokAuthenticatorFactory } from '@src/authenticators/tik-tok/factories/tik-tok-authenticator-factory';
// import { SadCaptchaSolverService } from '@src/services/common/captcha-solver/sad-captcha-solver-service';
// import { FileSystemSessionManager } from '@src/services/tik-tok/session-refresh/file-system-session-manager';
// import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
// import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
// import { EmailService } from '@src/services/common/email/email-service';
// import { PrismaModule } from '@src/database';
// import { Env } from '@src/config';
// import { PrismaService } from '@src/database';

// @Module({
//   imports: [PrismaModule],
//   controllers: [AuthController],
//   providers: [
//     TikTokAuthService,
//     TikTokAuthenticatorFactory,
//     BrowserPoolService,
//     TabManager,
//     PrismaService,
//     {
//       provide: TikTokAuthenticator,
//       useFactory: (factory: TikTokAuthenticatorFactory) => {
//         return factory.createAuthenticator(
//           new Logger(TikTokAuthenticator.name),
//         );
//       },
//       inject: [TikTokAuthenticatorFactory],
//     },
//     {
//       provide: SadCaptchaSolverService,
//       useFactory: () => {
//         return new SadCaptchaSolverService(
//           new Logger(SadCaptchaSolverService.name),
//           Env.SAD_CAPTCHA_API_KEY || '',
//           'storage/captcha-screenshots',
//         );
//       },
//     },
//     {
//       provide: FileSystemSessionManager,
//       useFactory: () => {
//         return new FileSystemSessionManager(
//           Env.SESSION_STORAGE_PATH || './storage/sessions',
//           new Logger(FileSystemSessionManager.name),
//         );
//       },
//     },
//     {
//       provide: EmailService,
//       useFactory: async (prisma: PrismaService) => {
//         const logger = new Logger(EmailService.name);

//         // Ищем подходящий email аккаунт для проверки кодов верификации
//         const emailAccount = await prisma.email.findFirst({
//           where: {
//             status: 'ACTIVE',
//             connection_details: {
//               not: undefined,
//             },
//           },
//         });

//         if (!emailAccount) {
//           logger.warn(
//             'No suitable email account found for verification code checking',
//           );
//           // Создаем с дефолтными значениями из окружения
//           return new EmailService(prisma, logger, {
//             id: 1,
//             email_address: Env.UKR_NET_EMAIL || '',
//             password: Env.UKR_NET_APP_PASSWORD || '',
//             imap_password: Env.UKR_NET_APP_PASSWORD || '', // Используем тот же пароль по умолчанию
//             connection_details: {
//               imap_host: Env.UKR_NET_IMAP_HOST || '',
//               imap_port: 993,
//               imap_secure: true,
//             },
//             provider: 'ukr.net',
//             username: Env.UKR_NET_EMAIL || '',
//             status: 'ACTIVE',
//             is_associated: false,
//             created_at: new Date(),
//             updated_at: new Date(),
//             last_check_timestamp: null,
//           });
//         }

//         logger.log(
//           `Using email account ${emailAccount.email_address} for verification code checking`,
//         );
//         return new EmailService(prisma, logger, emailAccount);
//       },
//       inject: [PrismaService],
//     },
//   ],
//   exports: [TikTokAuthService],
// })
// export class AuthModule {}
