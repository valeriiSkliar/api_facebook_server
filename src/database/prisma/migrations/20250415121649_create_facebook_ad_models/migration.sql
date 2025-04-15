-- CreateTable
CREATE TABLE `FacebookAdMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `ad_archive_id` VARCHAR(191) NOT NULL,
    `ad_id` VARCHAR(191) NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `page_name` VARCHAR(191) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `cta_text` VARCHAR(191) NULL,
    `cta_type` VARCHAR(191) NULL,
    `link_description` TEXT NULL,
    `link_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FacebookAdMaterial_ad_archive_id_key`(`ad_archive_id`),
    INDEX `FacebookAdMaterial_page_id_idx`(`page_id`),
    INDEX `FacebookAdMaterial_status_idx`(`status`),
    INDEX `FacebookAdMaterial_start_date_idx`(`start_date`),
    INDEX `FacebookAdMaterial_end_date_idx`(`end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdBody` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` TEXT NULL,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FacebookAdBody_facebook_ad_id_key`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` TEXT NULL,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `FacebookAdImage_facebook_ad_id_idx`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdVideo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` TEXT NULL,
    `thumbnail_url` TEXT NULL,
    `duration` DOUBLE NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `FacebookAdVideo_facebook_ad_id_idx`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdPlatform` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(191) NOT NULL,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `FacebookAdPlatform_facebook_ad_id_idx`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(191) NOT NULL,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `FacebookAdCategory_facebook_ad_id_idx`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAdMetrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `facebook_ad_id` VARCHAR(191) NOT NULL,
    `impressions` INTEGER NULL,
    `clicks` INTEGER NULL,
    `ctr` DOUBLE NULL,
    `reach` INTEGER NULL,
    `frequency` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FacebookAdMetrics_facebook_ad_id_key`(`facebook_ad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FacebookAdBody` ADD CONSTRAINT `FacebookAdBody_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAdImage` ADD CONSTRAINT `FacebookAdImage_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAdVideo` ADD CONSTRAINT `FacebookAdVideo_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAdPlatform` ADD CONSTRAINT `FacebookAdPlatform_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAdCategory` ADD CONSTRAINT `FacebookAdCategory_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAdMetrics` ADD CONSTRAINT `FacebookAdMetrics_facebook_ad_id_fkey` FOREIGN KEY (`facebook_ad_id`) REFERENCES `FacebookAdMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
