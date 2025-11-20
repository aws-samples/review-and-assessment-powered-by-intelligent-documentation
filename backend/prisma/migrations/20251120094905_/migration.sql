/*
  Warnings:

  - You are about to drop the column `mcp_server_name` on the `review_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `mcp_servers` on the `user_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `review_jobs` DROP COLUMN `mcp_server_name`;

-- AlterTable
ALTER TABLE `user_preferences` DROP COLUMN `mcp_servers`;
