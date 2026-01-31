-- AlterTable
ALTER TABLE `prompt_templates` ADD COLUMN `tool_configuration_id` VARCHAR(26) NULL;

-- CreateIndex
CREATE INDEX `prompt_templates_tool_configuration_id_idx` ON `prompt_templates`(`tool_configuration_id`);

-- AddForeignKey
ALTER TABLE `prompt_templates` ADD CONSTRAINT `prompt_templates_tool_configuration_id_fkey` FOREIGN KEY (`tool_configuration_id`) REFERENCES `tool_configurations`(`tool_configuration_id`) ON DELETE SET NULL ON UPDATE CASCADE;
