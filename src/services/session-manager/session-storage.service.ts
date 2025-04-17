import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { IStorageState } from '@src/core/interfaces/browser-cookie.type';
import { Session, Prisma } from '@prisma/client';

/**
 * Сервис для типобезопасного хранения и получения данных сессии
 */
@Injectable()
export class SessionStorageService {
  private readonly logger = new Logger(SessionStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Сохраняет данные сессии в базу данных
   * @param sessionId - ID сессии
   * @param storageState - Данные сессии из браузера
   * @returns Обновленная сессия
   */
  async saveSessionState(
    sessionId: number,
    storageState: IStorageState,
  ): Promise<Session> {
    this.logger.log(`Сохранение данных сессии с ID: ${sessionId}`);

    try {
      // Debug logging before transaction
      this.logger.debug(
        `Starting transaction to save session state for sessionId: ${sessionId}`,
      );
      this.logger.debug(
        `Storage state contains ${storageState.cookies?.length ?? 0} cookies and ${storageState.origins?.length ?? 0} origins`,
      );

      // Транзакция для атомарного обновления всех связанных данных
      return await this.prisma.$transaction(async (tx) => {
        try {
          // 1. Обновляем основную запись сессии
          this.logger.debug(
            `Updating session record for sessionId: ${sessionId}`,
          );
          const updatedSession = await tx.session.update({
            where: { id: sessionId },
            data: {
              session_data: JSON.parse(
                JSON.stringify(storageState),
              ) as unknown as Prisma.JsonObject,
              last_activity_timestamp: new Date(),
            },
          });
          this.logger.debug(
            `Session record updated successfully for sessionId: ${sessionId}`,
          );

          // 2. Удаляем существующие cookies для этой сессии
          this.logger.debug(
            `Deleting existing cookies for sessionId: ${sessionId}`,
          );
          const deleteResult = await tx.sessionCookie.deleteMany({
            where: { session_id: sessionId },
          });
          this.logger.debug(`Deleted ${deleteResult.count} existing cookies`);

          // 3. Создаем записи для cookies
          if (storageState.cookies && storageState.cookies.length > 0) {
            this.logger.debug(
              `Creating ${storageState.cookies.length} cookie records`,
            );
            for (const cookie of storageState.cookies) {
              try {
                await tx.sessionCookie.create({
                  data: {
                    session_id: sessionId,
                    name: cookie.name || '',
                    value: cookie.value || '',
                    domain: cookie.domain || '',
                    path: cookie.path || '',
                    expires: cookie.expires || 0,
                    http_only: cookie.httpOnly || false,
                    secure: cookie.secure || false,
                    same_site: cookie.sameSite,
                  },
                });
              } catch (cookieError) {
                this.logger.error(
                  `Error creating cookie record: ${cookieError instanceof Error ? cookieError.message : String(cookieError)}`,
                );
                this.logger.debug(
                  `Problematic cookie: ${JSON.stringify(cookie)}`,
                );
              }
            }
          }

          // 4. Обрабатываем localStorage
          if (storageState.origins && storageState.origins.length > 0) {
            this.logger.debug(
              `Processing ${storageState.origins.length} origins`,
            );
            // Для каждого origin
            for (const origin of storageState.origins) {
              try {
                // Удаляем существующий origin и связанные localStorage items
                const existingOrigin = await tx.sessionOrigin.findFirst({
                  where: {
                    session_id: sessionId,
                    origin: origin.origin,
                  },
                });

                if (existingOrigin) {
                  this.logger.debug(
                    `Found existing origin: ${origin.origin}, id: ${existingOrigin.id}`,
                  );
                  // Удаляем связанные localStorage items
                  const deleteLocalStorageResult =
                    await tx.sessionLocalStorage.deleteMany({
                      where: {
                        origin_id: existingOrigin.id,
                      },
                    });
                  this.logger.debug(
                    `Deleted ${deleteLocalStorageResult.count} localStorage items for origin: ${origin.origin}`,
                  );

                  // Удаляем origin
                  await tx.sessionOrigin.delete({
                    where: {
                      id: existingOrigin.id,
                    },
                  });
                  this.logger.debug(`Deleted origin record: ${origin.origin}`);
                }

                // Создаем новый origin
                if (origin.localStorage && origin.localStorage.length > 0) {
                  this.logger.debug(
                    `Creating new origin record for: ${origin.origin} with ${origin.localStorage.length} localStorage items`,
                  );
                  const newOrigin = await tx.sessionOrigin.create({
                    data: {
                      session_id: sessionId,
                      origin: origin.origin || '',
                    },
                  });
                  this.logger.debug(
                    `Created new origin with id: ${newOrigin.id}`,
                  );

                  // Создаем localStorage items
                  for (const item of origin.localStorage) {
                    try {
                      await tx.sessionLocalStorage.create({
                        data: {
                          origin_id: newOrigin.id,
                          name: item.name || '',
                          value: item.value || '',
                        },
                      });
                    } catch (localStorageError) {
                      this.logger.error(
                        `Error creating localStorage record: ${localStorageError instanceof Error ? localStorageError.message : String(localStorageError)}`,
                      );
                      this.logger.debug(
                        `Problematic localStorage item: ${JSON.stringify(item)}`,
                      );
                    }
                  }
                }
              } catch (originError) {
                this.logger.error(
                  `Error processing origin ${origin.origin}: ${originError instanceof Error ? originError.message : String(originError)}`,
                );
              }
            }
          }

          this.logger.debug(
            `Transaction completed successfully for sessionId: ${sessionId}`,
          );
          return updatedSession;
        } catch (txError) {
          this.logger.error(
            `Transaction error: ${txError instanceof Error ? txError.message : String(txError)}`,
          );
          throw txError;
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Ошибка при сохранении данных сессии: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Получает данные сессии из базы данных
   * @param sessionId - ID сессии
   * @returns Данные сессии в формате IStorageState
   */
  async getSessionState(sessionId: number): Promise<IStorageState> {
    this.logger.log(`Получение данных сессии с ID: ${sessionId}`);

    try {
      // Получаем сессию с cookies и origins
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          cookies: true,
          origins: {
            include: {
              localStorage: true,
            },
          },
        },
      });

      if (!session) {
        throw new Error(`Сессия с ID ${sessionId} не найдена`);
      }

      // Если есть данные в связанных таблицах, формируем IStorageState из них
      if (session.cookies.length > 0 || session.origins.length > 0) {
        const storageState: IStorageState = {
          cookies: session.cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            httpOnly: cookie.http_only,
            secure: cookie.secure,
            sameSite: cookie.same_site as 'Strict' | 'Lax' | 'None' | undefined,
          })),
          origins: session.origins.map((origin) => ({
            origin: origin.origin,
            localStorage: origin.localStorage.map((item) => ({
              name: item.name,
              value: item.value,
            })),
          })),
        };

        return storageState;
      }

      // Если связанных данных нет, используем JSON из session_data
      return session.session_data as unknown as IStorageState;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Ошибка при получении данных сессии: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Удаляет данные сессии из базы данных
   * @param sessionId - ID сессии
   */
  async deleteSessionState(sessionId: number): Promise<void> {
    this.logger.log(`Удаление данных сессии с ID: ${sessionId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Получаем все origins для сессии
        const origins = await tx.sessionOrigin.findMany({
          where: { session_id: sessionId },
        });

        // Удаляем localStorage для каждого origin
        for (const origin of origins) {
          await tx.sessionLocalStorage.deleteMany({
            where: { origin_id: origin.id },
          });
        }

        // Удаляем origins
        await tx.sessionOrigin.deleteMany({
          where: { session_id: sessionId },
        });

        // Удаляем cookies
        await tx.sessionCookie.deleteMany({
          where: { session_id: sessionId },
        });

        // Обновляем запись сессии
        await tx.session.update({
          where: { id: sessionId },
          data: {
            session_data: {},
            is_valid: false,
          },
        });
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Ошибка при удалении данных сессии: ${errorMessage}`);
      throw error;
    }
  }
}
