-- AlterTable
ALTER TABLE `check_list_sets` ADD COLUMN `next_action_template_id` VARCHAR(26) NULL;

-- AlterTable
ALTER TABLE `review_jobs` ADD COLUMN `next_action` TEXT NULL,
    ADD COLUMN `next_action_status` VARCHAR(20) NULL,
    ADD COLUMN `next_action_template_id` VARCHAR(26) NULL;
