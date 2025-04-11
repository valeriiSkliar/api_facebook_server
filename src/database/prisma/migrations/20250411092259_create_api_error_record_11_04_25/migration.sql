-- CreateTable
CREATE TABLE `ApiErrorRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `materialId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endpoint` VARCHAR(512) NOT NULL,
    `requestUrl` TEXT NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `errorType` VARCHAR(50) NOT NULL,
    `errorMessage` TEXT NULL,
    `headers` JSON NULL,
    `requestHeaders` JSON NULL,
    `requestBody` TEXT NULL,
    `requestId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `apiConfigId` INTEGER NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `wasResolved` BOOLEAN NOT NULL DEFAULT false,
    `responseTimeMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApiErrorRecord_errorType_idx`(`errorType`),
    INDEX `ApiErrorRecord_materialId_idx`(`materialId`),
    INDEX `ApiErrorRecord_sessionId_idx`(`sessionId`),
    INDEX `ApiErrorRecord_timestamp_idx`(`timestamp`),
    INDEX `ApiErrorRecord_endpoint_idx`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApiErrorRecord` ADD CONSTRAINT `ApiErrorRecord_apiConfigId_fkey` FOREIGN KEY (`apiConfigId`) REFERENCES `ApiConfiguration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
