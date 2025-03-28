-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `proxy_id` INTEGER NULL,
    `api_config_id` INTEGER NULL,
    `storage_path` VARCHAR(191) NOT NULL,
    `session_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `last_activity_timestamp` DATETIME(3) NULL,
    `is_valid` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL,

    INDEX `Session_is_valid_idx`(`is_valid`),
    INDEX `Session_status_idx`(`status`),
    INDEX `Session_last_activity_timestamp_idx`(`last_activity_timestamp`),
    INDEX `Session_email_idx`(`email`),
    INDEX `Session_proxy_id_idx`(`proxy_id`),
    INDEX `Session_api_config_id_idx`(`api_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_hash` VARCHAR(191) NOT NULL,
    `response_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `hit_count` INTEGER NOT NULL,
    `last_accessed_at` DATETIME(3) NULL,
    `request_id` INTEGER NULL,

    UNIQUE INDEX `Cache_request_id_key`(`request_id`),
    INDEX `Cache_request_hash_idx`(`request_hash`),
    INDEX `Cache_expires_at_idx`(`expires_at`),
    INDEX `Cache_last_accessed_at_idx`(`last_accessed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_request_id` VARCHAR(191) NOT NULL,
    `request_type` VARCHAR(191) NOT NULL,
    `parameters` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `session_id` INTEGER NOT NULL,
    `response_data` JSON NULL,
    `error_details` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL,
    `retry_count` INTEGER NOT NULL,
    `webhook_url` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Request_status_idx`(`status`),
    INDEX `Request_processed_at_idx`(`processed_at`),
    INDEX `Request_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TikTokAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `email_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `last_login_timestamp` DATETIME(3) NULL,
    `creation_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `verification_required` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_auth_success` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TikTokAccount_username_key`(`username`),
    INDEX `TikTokAccount_is_active_idx`(`is_active`),
    INDEX `TikTokAccount_username_idx`(`username`),
    INDEX `TikTokAccount_email_id_idx`(`email_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Email` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email_address` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `connection_details` JSON NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `last_check_timestamp` DATETIME(3) NULL,
    `is_associated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Email_email_address_key`(`email_address`),
    INDEX `Email_is_associated_idx`(`is_associated`),
    INDEX `Email_status_idx`(`status`),
    INDEX `Email_last_check_timestamp_idx`(`last_check_timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email_id` INTEGER NOT NULL,
    `tiktok_account_id` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `used_at` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `email_body` TEXT NULL,
    `sender_email` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `VerificationCode_status_idx`(`status`),
    INDEX `VerificationCode_email_id_idx`(`email_id`),
    INDEX `VerificationCode_tiktok_account_id_idx`(`tiktok_account_id`),
    UNIQUE INDEX `VerificationCode_code_message_id_key`(`code`, `message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiConfiguration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `api_version` VARCHAR(191) NOT NULL,
    `parameters` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `update_frequency` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proxy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `proxy_type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `last_check_timestamp` DATETIME(3) NULL,
    `success_rate` DOUBLE NOT NULL,
    `average_response_time` INTEGER NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Proxy_status_idx`(`status`),
    INDEX `Proxy_last_check_timestamp_idx`(`last_check_timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `severity` VARCHAR(191) NOT NULL,
    `related_request_id` INTEGER NULL,
    `email_id` INTEGER NULL,
    `tiktok_id` INTEGER NULL,
    `request_id` INTEGER NULL,
    `proxy_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ActivityLog_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `ActivityLog_related_request_id_idx`(`related_request_id`),
    INDEX `ActivityLog_email_id_idx`(`email_id`),
    INDEX `ActivityLog_tiktok_id_idx`(`tiktok_id`),
    INDEX `ActivityLog_request_id_idx`(`request_id`),
    INDEX `ActivityLog_proxy_id_idx`(`proxy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `query` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Statistics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `request_count` INTEGER NOT NULL,
    `success_count` INTEGER NOT NULL,
    `failure_count` INTEGER NOT NULL,
    `average_response_time` DOUBLE NOT NULL,
    `cache_hit_rate` DOUBLE NOT NULL,
    `blocked_session_count` INTEGER NOT NULL,
    `details` JSON NOT NULL,

    INDEX `Statistics_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_email_fkey` FOREIGN KEY (`email`) REFERENCES `Email`(`email_address`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_proxy_id_fkey` FOREIGN KEY (`proxy_id`) REFERENCES `Proxy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_api_config_id_fkey` FOREIGN KEY (`api_config_id`) REFERENCES `ApiConfiguration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cache` ADD CONSTRAINT `Cache_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `Request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Request` ADD CONSTRAINT `Request_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TikTokAccount` ADD CONSTRAINT `TikTokAccount_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `Email`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationCode` ADD CONSTRAINT `VerificationCode_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `Email`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationCode` ADD CONSTRAINT `VerificationCode_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `TikTokAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `Email`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_tiktok_id_fkey` FOREIGN KEY (`tiktok_id`) REFERENCES `TikTokAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `Request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_proxy_id_fkey` FOREIGN KEY (`proxy_id`) REFERENCES `Proxy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
