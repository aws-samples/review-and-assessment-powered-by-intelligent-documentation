-- AlterTable
ALTER TABLE `check_list_sets` ADD COLUMN `user_id` VARCHAR(50) NULL;

-- Data migration from checklist_documents
UPDATE `check_list_sets` AS cls
JOIN (
  SELECT `check_list_set_id`, MIN(`user_id`) AS `user_id`
  FROM `checklist_documents`
  WHERE `user_id` IS NOT NULL
  GROUP BY `check_list_set_id`
) AS docs ON docs.`check_list_set_id` = cls.`check_list_set_id`
SET cls.`user_id` = docs.`user_id`;

-- Data migration from review_jobs (for sets without documents)
UPDATE `check_list_sets` AS cls
JOIN (
  SELECT `check_list_set_id`, MIN(`user_id`) AS `user_id`
  FROM `review_jobs`
  WHERE `user_id` IS NOT NULL
  GROUP BY `check_list_set_id`
) AS jobs ON jobs.`check_list_set_id` = cls.`check_list_set_id`
SET cls.`user_id` = jobs.`user_id`
WHERE cls.`user_id` IS NULL;

-- Final fallback for legacy orphan rows
UPDATE `check_list_sets`
SET `user_id` = 'migration-system'
WHERE `user_id` IS NULL;

-- Ensure not null
ALTER TABLE `check_list_sets` MODIFY `user_id` VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE INDEX `idx_check_list_sets_user_id` ON `check_list_sets`(`user_id`);
