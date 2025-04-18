-- DropForeignKey
ALTER TABLE `Request` DROP FOREIGN KEY `Request_session_id_fkey`;

-- AlterTable
ALTER TABLE `Request` MODIFY `session_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Request` ADD CONSTRAINT `Request_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
