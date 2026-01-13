// MCP SDK imports: wildcard pattern requires .js extension for module resolution
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Logger } from "../../../../../review-workflow/utils/logger";

const logger = new Logger("mcp-tools-service");

export interface MCPServerConfig {
  // stdio transport fields
  command?: string;
  args?: string[];

  // HTTP transport fields
  url?: string;

  // Optional configuration
  headers?: Record<string, string>;
  oauthScopes?: string[];
  env?: Record<string, string>;
  timeout?: number;
  disabled?: boolean;
  disabledTools?: string[];
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface PreviewResult {
  serverName: string;
  status: "success" | "error";
  tools?: MCPToolInfo[];
  error?: string;
}

export async function previewMcpTools(
  mcpConfig: Record<string, MCPServerConfig>
): Promise<PreviewResult[]> {
  const results: PreviewResult[] = [];

  for (const [serverName, config] of Object.entries(mcpConfig)) {
    try {
      const tools = await listToolsFromServer(config);
      results.push({
        serverName,
        status: "success",
        tools,
      });
    } catch (error) {
      results.push({
        serverName,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Lists available tools from an MCP server.
 *
 * SECURITY NOTES:
 * - For stdio transport: Executes user-provided commands. Ensure config is from trusted sources.
 * - For HTTP transport: Connects to user-provided URLs. Consider network security policies.
 * - Lambda environment: Enhanced PATH includes UV and NPM for package manager support.
 *
 * @param config MCP server configuration (HTTP or stdio transport)
 * @returns Array of tool information from the MCP server
 * @throws Error if configuration is invalid or connection fails
 */
async function listToolsFromServer(
  config: MCPServerConfig
): Promise<MCPToolInfo[]> {
  let transport;
  let client;

  try {
    // Detect HTTP transport
    const isHttp =
      config.url &&
      (config.url.startsWith("http://") || config.url.startsWith("https://"));

    if (isHttp) {
      // HTTP transport
      transport = new StreamableHTTPClientTransport(new URL(config.url!));
    } else if (config.command && config.args) {
      // stdio transport
      // Add PATH and cache directories to ensure uvx/npx work in Lambda
      const env = {
        ...process.env,
        PATH: `${process.env.PATH || ""}:/usr/local/bin:/opt/homebrew/bin:/tmp/.npm-global/bin`,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR || "/tmp/.uv",
        UV_TOOL_DIR: process.env.UV_TOOL_DIR || "/tmp/.uv/tools",
        NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || "/tmp/.npm",
        NPM_CONFIG_PREFIX: process.env.NPM_CONFIG_PREFIX || "/tmp/.npm-global",
        ...config.env,
      };

      // SECURITY WARNING: User-provided command and args are executed directly via StdioClientTransport.
      // This configuration should ONLY be modifiable by authenticated, authorized users.
      // The StdioClientTransport does not sanitize these values.
      // Ensure mcpConfig data comes from trusted sources and is validated at API boundaries.
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });
    } else {
      throw new Error("Invalid MCP config: must have url or (command + args)");
    }

    client = new Client(
      {
        name: "rapid-mcp-preview",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Add timeout for connection
    const timeout = config.timeout || 30000;
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Connection timeout after ${timeout}ms`)),
        timeout
      )
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // List tools with timeout
    const listToolsPromise = client.listTools();
    const listTimeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`List tools timeout after ${timeout}ms`)),
        timeout
      )
    );

    const response = await Promise.race([listToolsPromise, listTimeout]);

    return (response as any).tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore close errors
        logger.error("Error closing MCP client:", error);
      }
    }
  }
}
