/*
  Warnings:

  - Added the required column `user_email` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Request` ADD COLUMN `user_email` VARCHAR(191) NOT NULL,
    ADD COLUMN `user_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `Request_user_id_idx` ON `Request`(`user_id`);

-- CreateIndex
CREATE INDEX `Request_user_email_idx` ON `Request`(`user_email`);
