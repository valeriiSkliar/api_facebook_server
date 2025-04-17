-- CreateTable
CREATE TABLE `SessionCookie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `expires` DOUBLE NOT NULL,
    `http_only` BOOLEAN NOT NULL,
    `secure` BOOLEAN NOT NULL,
    `same_site` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `SessionCookie_session_id_idx`(`session_id`),
    INDEX `SessionCookie_domain_idx`(`domain`),
    INDEX `SessionCookie_name_idx`(`name`),
    UNIQUE INDEX `SessionCookie_session_id_name_domain_path_key`(`session_id`, `name`, `domain`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionOrigin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `origin` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `SessionOrigin_session_id_idx`(`session_id`),
    INDEX `SessionOrigin_origin_idx`(`origin`),
    UNIQUE INDEX `SessionOrigin_session_id_origin_key`(`session_id`, `origin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionLocalStorage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `origin_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `SessionLocalStorage_origin_id_idx`(`origin_id`),
    INDEX `SessionLocalStorage_name_idx`(`name`),
    UNIQUE INDEX `SessionLocalStorage_origin_id_name_key`(`origin_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SessionCookie` ADD CONSTRAINT `SessionCookie_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionOrigin` ADD CONSTRAINT `SessionOrigin_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionLocalStorage` ADD CONSTRAINT `SessionLocalStorage_origin_id_fkey` FOREIGN KEY (`origin_id`) REFERENCES `SessionOrigin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Request` ADD CONSTRAINT `Request_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
