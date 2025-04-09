-- CreateTable
CREATE TABLE `DetailMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `ad_title` VARCHAR(191) NOT NULL,
    `brand_name` VARCHAR(191) NOT NULL,
    `comment` INTEGER NOT NULL,
    `cost` DOUBLE NOT NULL,
    `ctr` DOUBLE NOT NULL,
    `favorite` BOOLEAN NOT NULL,
    `has_summary` BOOLEAN NOT NULL,
    `highlight_text` VARCHAR(191) NOT NULL,
    `industry_key` VARCHAR(191) NOT NULL,
    `is_search` BOOLEAN NOT NULL,
    `landing_page` VARCHAR(191) NOT NULL,
    `like` INTEGER NOT NULL,
    `objective_key` VARCHAR(191) NOT NULL,
    `share` INTEGER NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `source_key` INTEGER NOT NULL,
    `tag` INTEGER NOT NULL,
    `voice_over` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CountryCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `detail_material_id` VARCHAR(191) NOT NULL,

    INDEX `CountryCode_detail_material_id_idx`(`detail_material_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Keyword` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(191) NOT NULL,
    `detail_material_id` VARCHAR(191) NOT NULL,

    INDEX `Keyword_detail_material_id_idx`(`detail_material_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pattern` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `detail_material_id` VARCHAR(191) NOT NULL,

    INDEX `Pattern_detail_material_id_idx`(`detail_material_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Objective` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `detail_material_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VideoInfo` (
    `id` VARCHAR(191) NOT NULL,
    `vid` VARCHAR(191) NOT NULL,
    `duration` DOUBLE NOT NULL,
    `cover` VARCHAR(191) NOT NULL,
    `video_url_720p` VARCHAR(191) NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `detail_material_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `VideoInfo_vid_key`(`vid`),
    UNIQUE INDEX `VideoInfo_detail_material_id_key`(`detail_material_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CountryCode` ADD CONSTRAINT `CountryCode_detail_material_id_fkey` FOREIGN KEY (`detail_material_id`) REFERENCES `DetailMaterial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Keyword` ADD CONSTRAINT `Keyword_detail_material_id_fkey` FOREIGN KEY (`detail_material_id`) REFERENCES `DetailMaterial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pattern` ADD CONSTRAINT `Pattern_detail_material_id_fkey` FOREIGN KEY (`detail_material_id`) REFERENCES `DetailMaterial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Objective` ADD CONSTRAINT `Objective_detail_material_id_fkey` FOREIGN KEY (`detail_material_id`) REFERENCES `DetailMaterial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoInfo` ADD CONSTRAINT `VideoInfo_detail_material_id_fkey` FOREIGN KEY (`detail_material_id`) REFERENCES `DetailMaterial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
