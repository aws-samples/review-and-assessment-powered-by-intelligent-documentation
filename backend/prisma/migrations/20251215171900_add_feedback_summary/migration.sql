-- AlterTable
ALTER TABLE `check_lists` ADD COLUMN `feedback_summary` TEXT NULL,
ADD COLUMN `feedback_summary_updated_at` TIMESTAMP(0) NULL;
