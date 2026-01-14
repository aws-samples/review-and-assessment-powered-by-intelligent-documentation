import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const handler = async (event: any) => {
  const { toolName, input } = event;

  let transport;
  let client;

  try {
    // Launch aws-api-mcp-server via stdio
    transport = new StdioClientTransport({
      command: 'uvx',
      args: ['awslabs.aws-api-mcp-server@latest'],
      env: {
        ...process.env,
        HOME: '/tmp',
        AWS_CONFIG_FILE: '/tmp/.aws/config',
        AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      },
    });

    client = new Client(
      { name: 'uc008-mcp-proxy', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    // Forward tool call to aws-api-mcp-server
    const response = await client.callTool({
      name: toolName,
      arguments: input,
    });

    return {
      content: response.content,
      isError: response.isError,
    };
  } catch (error: any) {
    console.error('MCP proxy error:', error);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};
