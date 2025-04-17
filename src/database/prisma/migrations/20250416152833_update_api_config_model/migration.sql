/*
  Warnings:

  - Added the required column `accountId` to the `ApiConfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endpoint` to the `ApiConfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `ApiConfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `headers` to the `ApiConfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `ApiConfiguration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ApiConfiguration` ADD COLUMN `accountId` INTEGER NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `endpoint` VARCHAR(191) NOT NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NOT NULL,
    ADD COLUMN `headers` JSON NOT NULL,
    ADD COLUMN `lastUsedAt` DATETIME(3) NULL,
    ADD COLUMN `method` VARCHAR(191) NOT NULL,
    ADD COLUMN `responseData` JSON NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `usageCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `ApiConfiguration_accountId_status_idx` ON `ApiConfiguration`(`accountId`, `status`);

-- CreateIndex
CREATE INDEX `ApiConfiguration_status_expiresAt_idx` ON `ApiConfiguration`(`status`, `expiresAt`);
