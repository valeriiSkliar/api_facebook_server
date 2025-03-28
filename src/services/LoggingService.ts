// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';

// @Injectable()
// export class LoggingService {
//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly logger: Logger,
//   ) {}

//   async logRequestEvent(
//     requestId: string,
//     event: string,
//     details?: any,
//   ): Promise<void> {
//     // Log to database
//     await this.prisma.requestLog.create({
//       data: {
//         requestId,
//         event,
//         details: details ? JSON.stringify(details) : null,
//         timestamp: new Date(),
//       },
//     });

//     // Also log to application logs
//     this.logger.log(`Request ${requestId}: ${event}`, details);
//   }
// }
