-- AlterTable
ALTER TABLE `check_lists` ADD COLUMN `tool_configuration_id` VARCHAR(26) NULL;

-- CreateTable
CREATE TABLE `tool_configurations` (
    `tool_configuration_id` VARCHAR(26) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `knowledge_base` JSON NULL,
    `code_interpreter` BOOLEAN NOT NULL DEFAULT false,
    `mcp_config` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`tool_configuration_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_check_list_tool_config` ON `check_lists`(`tool_configuration_id`);

-- AddForeignKey
ALTER TABLE `check_lists` ADD CONSTRAINT `check_lists_tool_configuration_id_fkey` FOREIGN KEY (`tool_configuration_id`) REFERENCES `tool_configurations`(`tool_configuration_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
