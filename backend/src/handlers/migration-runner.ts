import { Handler } from "aws-lambda";
import { exec } from "child_process";
import { getDatabaseUrl } from "../utils/database";

// Define allowed Prisma migration commands
const ALLOWED_COMMANDS = ["deploy", "reset", "status", "up", "down"] as const;
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

/**
 * Validates if the provided command is one of the allowed Prisma migration commands
 * @param command The command to validate
 * @returns The validated command or "deploy" as default
 */
const validateCommand = (command: unknown): AllowedCommand => {
  if (typeof command !== "string") return "deploy";

  const sanitizedCommand = command.trim().toLowerCase();
  if (ALLOWED_COMMANDS.includes(sanitizedCommand as AllowedCommand)) {
    return sanitizedCommand as AllowedCommand;
  }

  // If not a valid command, return the default
  return "deploy";
};

/**
 * Handler for running Prisma migrations
 */
export const handler: Handler = async (event, _) => {
  // DATABASE_URLを環境変数に設定（マイグレーション実行前に必要）
  process.env.DATABASE_URL = await getDatabaseUrl();

  // Sanitize the command input
  const command: AllowedCommand = validateCommand(event.command);
  let options: string[] = [];

  if (command === "reset") {
    options = ["--force", "--skip-generate", "--skip-seed"];
  }

  try {
    const exitCode = await new Promise<number>((resolve, _) => {
      exec(
        `npx prisma migrate ${command} ${options.join(" ")}`,
        (error, stdout, stderr) => {
          console.log(stdout);
          if (stderr) console.error(stderr);
          if (error != null) {
            console.log(
              `npx prisma migrate ${command} exited with error ${error.message}`
            );
            resolve(error.code ?? 1);
          } else {
            resolve(0);
          }
        }
      );
    });

    if (exitCode !== 0)
      throw Error(`command ${command} failed with exit code ${exitCode}`);
  } catch (e) {
    console.log(e);
    throw e;
  }
};
