import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executes multiple Prisma operations within a single transaction.
   * @param callback A function that receives the Prisma transaction client and returns a promise.
   * @returns The result of the callback function.
   */
  async transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(callback);
  }

  /**
   * Handles Prisma known request errors and throws appropriate NestJS HTTP exceptions.
   * @param error The error object caught.
   * @throws {NotFoundException} When a related record is not found (P2025).
   * @throws {ConflictException} When a unique constraint violation occurs (P2002).
   * @throws {InternalServerErrorException} For other Prisma errors or unexpected errors.
   */
  handleError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          // Unique constraint violation

          const target = error.meta?.target as string | string[];
          throw new ConflictException(
            `Unique constraint failed on field(s): ${Array.isArray(target) ? target.join(', ') : target}`,
          );
        }
        case 'P2025': // Record to update not found or relation violation
          throw new NotFoundException(
            (error.meta?.cause as string | undefined) || 'Record not found.',
          );
        // Add more Prisma error codes as needed
        default:
          // Log the error for debugging purposes
          console.error('Unhandled Prisma Error:', error);
          throw new InternalServerErrorException(
            'An unexpected database error occurred.',
          );
      }
    } else {
      // Log the error for debugging purposes
      console.error('Unexpected Error:', error);
      // Re-throw if it's not a Prisma error, or wrap it
      throw new InternalServerErrorException('An unexpected error occurred.');
    }
  }
}
