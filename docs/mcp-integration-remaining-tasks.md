# MCP Integration - Remaining Tasks

## 実装済み内容

### 背景
Model Context Protocol (MCP)をreview-item-processorに統合し、エージェントが外部ツール（AWS Documentation検索など）を利用できるようにする。

### 完了した実装

#### 1. バックエンド実装（uvx対応）
- **ファイル**: `review-item-processor/tools/mcp_tool.py`
  - `create_mcp_clients()`: MCPクライアントファクトリー関数
  - uvx経由でMCPサーバーを起動（stdio transport）
  - 設定形式: `{"package": "awslabs.aws-documentation-mcp-server@latest"}`

- **ファイル**: `review-item-processor/tools/factory.py`
  - `create_custom_tools()`に`mcpConfig`処理を追加
  - MCPクライアントを他のツールと統合

- **ファイル**: `review-item-processor/agent.py`
  - Strands Managed Integration (experimental)を採用
  - MCPClientをAgentに直接渡すだけでライフサイクル自動管理
  - ExitStackによる手動管理は不要（削除済み）
  - `_run_strands_agent_legacy()`と`_run_strands_agent_with_citations()`の両方で対応

#### 2. テストコード
- **ファイル**: `review-item-processor/test_mcp.py`
  - AWS Documentation MCP serverを使用したテスト
  - S3からPDFを読み込み、MCPツールでAWS Lambdaの情報を検索
  - ツール使用履歴の検証

#### 3. 設定形式
```python
toolConfiguration = {
    "mcpConfig": [
        {"package": "awslabs.aws-documentation-mcp-server@latest"}
    ]
}
```

### 技術的詳細

#### Strands Managed Integration
- MCPClientをAgentのtoolsリストに直接追加
- Agentが自動的にMCPサーバーの起動・ツール検出・クリーンアップを実行
- `with`文による手動管理は不要

#### 現在の制限
- **トランスポート**: uvx (stdio) のみ対応
- **実装範囲**: バックエンド（review-item-processor）のみ
- **フロントエンド**: 未実装

---

## 残タスク

### Task 1: npx対応の追加

#### 目的
Node.js/TypeScriptベースのMCPサーバーをnpx経由で実行できるようにする。

#### 実装箇所
**ファイル**: `review-item-processor/tools/mcp_tool.py`

#### 実装内容
1. 設定形式の拡張
```python
# 現在（uvxのみ）
{"package": "awslabs.aws-documentation-mcp-server@latest"}

# 拡張後（transportフィールド追加）
{"package": "awslabs.aws-documentation-mcp-server@latest", "transport": "uvx"}  # デフォルト
{"package": "@modelcontextprotocol/server-filesystem", "transport": "npx"}
```

2. `create_mcp_clients()`の修正
```python
def create_mcp_clients(mcp_config: Optional[List[Dict[str, Any]]]) -> List[MCPClient]:
    """
    Create MCP clients from configuration.
    
    Supports:
    - uvx: Python-based MCP servers
    - npx: Node.js/TypeScript-based MCP servers
    """
    if not mcp_config:
        logger.debug("No MCP configuration provided")
        return []

    clients = []
    for server_cfg in mcp_config:
        package = server_cfg.get("package")
        transport = server_cfg.get("transport", "uvx")  # デフォルトはuvx
        
        if not package:
            logger.warning(f"MCP server config missing 'package': {server_cfg}")
            continue

        try:
            # トランスポートに応じてコマンドを選択
            if transport == "npx":
                command = "npx"
                args = ["-y", package]  # -y: 自動インストール
            elif transport == "uvx":
                command = "uvx"
                args = [package]
            else:
                logger.error(f"Unsupported transport: {transport}")
                continue
            
            client = MCPClient(
                lambda cmd=command, a=args: stdio_client(
                    StdioServerParameters(command=cmd, args=a)
                )
            )
            clients.append(client)
            logger.debug(f"Created MCP client for package: {package} (transport: {transport})")
        except Exception as e:
            logger.error(f"Failed to create MCP client for {package}: {e}")

    logger.info(f"Created {len(clients)} MCP client(s)")
    return clients
```

#### テスト
`test_mcp.py`を拡張してnpxベースのサーバーもテスト:
```python
# npxテスト例
mcp_config = [
    {"package": "@modelcontextprotocol/server-filesystem", "transport": "npx"}
]
```

#### 参考
- Strandsドキュメント: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/mcp-tools/
- MCP公式サーバー一覧: https://github.com/modelcontextprotocol/servers

---

### Task 2: フロントエンド実装

#### 目的
ユーザーがチェックリスト作成時にMCPツールを設定できるUIを提供する。

#### 実装箇所

##### 2.1 バックエンドAPI拡張
**ファイル**: `backend/src/api/features/checklist-management/domain/model/checklist.ts`

チェックリストモデルに`toolConfiguration`フィールドを追加:
```typescript
export interface CheckListSetModel {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentModel[];
  toolConfiguration?: {
    mcpConfig?: Array<{
      package: string;
      transport?: 'uvx' | 'npx';
    }>;
  };
}
```

**ファイル**: `backend/prisma/schema.prisma`

Prismaスキーマに`toolConfiguration`カラムを追加:
```prisma
model CheckListSet {
  id                  String   @id @default(uuid())
  name                String
  description         String
  toolConfiguration   Json?    // MCPツール設定を格納
  // ... 既存フィールド
}
```

マイグレーション実行:
```bash
cd backend
npm run prisma:migrate:dev
```

##### 2.2 フロントエンドUI実装
**ファイル**: `frontend/src/features/checklist/components/ChecklistForm.tsx`（新規作成）

MCP設定用のフォームコンポーネント:
```typescript
interface McpServerConfig {
  package: string;
  transport: 'uvx' | 'npx';
}

interface ChecklistFormProps {
  onSubmit: (data: ChecklistFormData) => void;
}

export const ChecklistForm: React.FC<ChecklistFormProps> = ({ onSubmit }) => {
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);

  const addMcpServer = () => {
    setMcpServers([...mcpServers, { package: '', transport: 'uvx' }]);
  };

  const removeMcpServer = (index: number) => {
    setMcpServers(mcpServers.filter((_, i) => i !== index));
  };

  const updateMcpServer = (index: number, field: keyof McpServerConfig, value: string) => {
    const updated = [...mcpServers];
    updated[index] = { ...updated[index], [field]: value };
    setMcpServers(updated);
  };

  return (
    <div>
      {/* 既存のチェックリストフォーム */}
      
      {/* MCP設定セクション */}
      <div className="mt-6">
        <h3 className="text-lg font-medium">MCP Tools (Optional)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Add external tools via Model Context Protocol
        </p>
        
        {mcpServers.map((server, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Package name (e.g., awslabs.aws-documentation-mcp-server@latest)"
              value={server.package}
              onChange={(e) => updateMcpServer(index, 'package', e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
            />
            <select
              value={server.transport}
              onChange={(e) => updateMcpServer(index, 'transport', e.target.value as 'uvx' | 'npx')}
              className="px-3 py-2 border rounded"
            >
              <option value="uvx">uvx (Python)</option>
              <option value="npx">npx (Node.js)</option>
            </select>
            <button
              onClick={() => removeMcpServer(index)}
              className="px-3 py-2 bg-red-500 text-white rounded"
            >
              Remove
            </button>
          </div>
        ))}
        
        <button
          onClick={addMcpServer}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          + Add MCP Server
        </button>
      </div>
    </div>
  );
};
```

##### 2.3 API統合
**ファイル**: `frontend/src/features/checklist/hooks/useCreateChecklist.ts`

チェックリスト作成時にtoolConfigurationを送信:
```typescript
export const useCreateChecklist = () => {
  const createChecklist = async (data: ChecklistFormData) => {
    const payload = {
      name: data.name,
      description: data.description,
      documents: data.documents,
      toolConfiguration: {
        mcpConfig: data.mcpServers.filter(s => s.package.trim() !== '')
      }
    };
    
    const response = await fetch('/api/checklist-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    return response.json();
  };
  
  return { createChecklist };
};
```

#### UI/UX考慮事項
- MCP設定はオプション（デフォルトは空）
- よく使うMCPサーバーのプリセット提供を検討
  - AWS Documentation: `awslabs.aws-documentation-mcp-server@latest` (uvx)
  - Filesystem: `@modelcontextprotocol/server-filesystem` (npx)
- パッケージ名のバリデーション
- トランスポート選択のヘルプテキスト

---

## 実装の優先順位

1. **Task 1 (npx対応)**: バックエンドのみの変更で影響範囲が小さい
2. **Task 2 (フロントエンド)**: データベーススキーマ変更を含むため慎重に実装

## 参考資料

- Strandsドキュメント: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/mcp-tools/
- MCP公式サイト: https://modelcontextprotocol.io
- MCP Servers一覧: https://github.com/modelcontextprotocol/servers
- 既存実装: `review-item-processor/tools/mcp_tool.py`, `review-item-processor/agent.py`
- テストコード: `review-item-processor/test_mcp.py`
