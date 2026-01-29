-- AlterTable
ALTER TABLE `check_list_sets` ADD COLUMN `user_id` VARCHAR(50) NULL;

-- Data migration
UPDATE `check_list_sets` AS cls
JOIN (
  SELECT `check_list_set_id`, MIN(`user_id`) AS `user_id`
  FROM `check_list_documents`
  WHERE `user_id` IS NOT NULL
  GROUP BY `check_list_set_id`
) AS docs ON docs.`check_list_set_id` = cls.`check_list_set_id`
SET cls.`user_id` = docs.`user_id`;

-- Ensure not null
ALTER TABLE `check_list_sets` MODIFY `user_id` VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE INDEX `idx_check_list_sets_user_id` ON `check_list_sets`(`user_id`);
