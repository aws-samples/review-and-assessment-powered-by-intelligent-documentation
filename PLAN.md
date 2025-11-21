# ツール設定機能 完全実装計画 (最終版)

## 概要
チェック項目ごとに異なるツール(KnowledgeBase, CodeInterpreter, MCP)の組み合わせを設定できる機能を実装します。

## 1. データベーススキーマ設計

### 1.1 新規テーブル: `tool_configurations`

```prisma
model ToolConfiguration {
  id                String   @id @map("tool_configuration_id") @db.VarChar(26)
  name              String   @db.VarChar(255)
  description       String?  @db.Text
  
  // Knowledge Base設定 (JSON)
  knowledgeBase     Json?    @map("knowledge_base")
  // [{ knowledgeBaseId: string, dataSourceIds?: string[] }]
  
  // Code Interpreter有効化フラグ
  codeInterpreter   Boolean  @default(false) @map("code_interpreter")
  
  // MCP設定 (JSON)
  mcpConfig         Json?    @map("mcp_config")
  
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamp(0)
  
  checkLists        CheckList[]
  
  @@map("tool_configurations")
}
```

### 1.2 既存テーブル修正: `check_lists`

```prisma
model CheckList {
  // ... 既存フィールド
  toolConfigurationId String?            @map("tool_configuration_id") @db.VarChar(26)
  toolConfiguration   ToolConfiguration? @relation(fields: [toolConfigurationId], references: [id], onDelete: Restrict)
  
  @@index([toolConfigurationId], map: "idx_check_list_tool_config")
}
```

**重要**: `onDelete: Restrict` により、使用中のツール設定は削除不可

## 2. Backend実装

### 2.1 新規Feature: `tool-configuration`

#### ディレクトリ構造
```
backend/src/api/features/tool-configuration/
├── domain/
│   ├── model/
│   │   └── tool-configuration.ts
│   └── repository.ts
├── usecase/
│   └── tool-configuration.ts
└── routes/
    ├── index.ts
    └── handlers.ts
```

#### 2.1.1 Domain Model (`domain/model/tool-configuration.ts`)

```typescript
import { ulid } from "ulid";

export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

export interface ToolConfigurationEntity {
  id: string;
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const ToolConfigurationDomain = {
  fromCreateRequest: (req: {
    name: string;
    description?: string;
    knowledgeBase?: KnowledgeBaseConfig[];
    codeInterpreter: boolean;
    mcpConfig?: any;
  }): ToolConfigurationEntity => {
    return {
      id: ulid(),
      name: req.name,
      description: req.description,
      knowledgeBase: req.knowledgeBase,
      codeInterpreter: req.codeInterpreter,
      mcpConfig: req.mcpConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
```

#### 2.1.2 Repository (`domain/repository.ts`)

```typescript
import { PrismaClient, getPrismaClient } from "../../../core/db";
import { NotFoundError } from "../../../core/errors";
import { ToolConfigurationEntity } from "./model/tool-configuration";

export interface ToolConfigurationRepository {
  create(config: ToolConfigurationEntity): Promise<void>;
  findAll(): Promise<ToolConfigurationEntity[]>;
  findById(id: string): Promise<ToolConfigurationEntity>;
  delete(id: string): Promise<void>;
  isUsedByCheckLists(id: string): Promise<boolean>;
}

export const makePrismaToolConfigurationRepository = async (
  clientInput: PrismaClient | null = null
): Promise<ToolConfigurationRepository> => {
  const client = clientInput || (await getPrismaClient());

  const create = async (config: ToolConfigurationEntity): Promise<void> => {
    await client.toolConfiguration.create({
      data: {
        id: config.id,
        name: config.name,
        description: config.description,
        knowledgeBase: config.knowledgeBase || null,
        codeInterpreter: config.codeInterpreter,
        mcpConfig: config.mcpConfig || null,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  };

  const findAll = async (): Promise<ToolConfigurationEntity[]> => {
    const configs = await client.toolConfiguration.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { checkLists: true },
        },
      },
    });

    return configs.map((config) => ({
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      knowledgeBase: config.knowledgeBase ? (config.knowledgeBase as any) : undefined,
      codeInterpreter: config.codeInterpreter,
      mcpConfig: config.mcpConfig ? (config.mcpConfig as any) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      usageCount: (config as any)._count.checkLists,
    }));
  };

  const findById = async (id: string): Promise<ToolConfigurationEntity> => {
    const config = await client.toolConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundError("Tool configuration not found", id);
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      knowledgeBase: config.knowledgeBase ? (config.knowledgeBase as any) : undefined,
      codeInterpreter: config.codeInterpreter,
      mcpConfig: config.mcpConfig ? (config.mcpConfig as any) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  };

  const delete = async (id: string): Promise<void> => {
    await client.toolConfiguration.delete({
      where: { id },
    });
  };

  const isUsedByCheckLists = async (id: string): Promise<boolean> => {
    const count = await client.checkList.count({
      where: { toolConfigurationId: id },
    });
    return count > 0;
  };

  return {
    create,
    findAll,
    findById,
    delete,
    isUsedByCheckLists,
  };
};
```

#### 2.1.3 Usecase (`usecase/tool-configuration.ts`)

```typescript
import {
  ToolConfigurationEntity,
  ToolConfigurationDomain,
  KnowledgeBaseConfig,
} from "../domain/model/tool-configuration";
import {
  ToolConfigurationRepository,
  makePrismaToolConfigurationRepository,
} from "../domain/repository";
import { ApplicationError } from "../../../core/errors";

export const createToolConfiguration = async (params: {
  request: {
    name: string;
    description?: string;
    knowledgeBase?: KnowledgeBaseConfig[];
    codeInterpreter: boolean;
    mcpConfig?: any;
  };
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity> => {
  const repo = params.deps?.repo || (await makePrismaToolConfigurationRepository());
  const config = ToolConfigurationDomain.fromCreateRequest(params.request);
  await repo.create(config);
  return config;
};

export const getAllToolConfigurations = async (params: {
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity[]> => {
  const repo = params.deps?.repo || (await makePrismaToolConfigurationRepository());
  return repo.findAll();
};

export const getToolConfigurationById = async (params: {
  id: string;
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity> => {
  const repo = params.deps?.repo || (await makePrismaToolConfigurationRepository());
  return repo.findById(params.id);
};

export const deleteToolConfiguration = async (params: {
  id: string;
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaToolConfigurationRepository());

  const isUsed = await repo.isUsedByCheckLists(params.id);
  if (isUsed) {
    throw new ApplicationError(
      "Cannot delete tool configuration that is in use by checklist items"
    );
  }

  await repo.delete(params.id);
};
```

#### 2.1.4 Routes & Handlers

```typescript
// routes/index.ts
import { FastifyInstance } from "fastify";
import {
  getAllToolConfigurationsHandler,
  getToolConfigurationByIdHandler,
  createToolConfigurationHandler,
  deleteToolConfigurationHandler,
} from "./handlers";

export function registerToolConfigurationRoutes(fastify: FastifyInstance): void {
  fastify.get("/tool-configurations", {
    handler: getAllToolConfigurationsHandler,
  });

  fastify.get("/tool-configurations/:id", {
    handler: getToolConfigurationByIdHandler,
  });

  fastify.post("/tool-configurations", {
    handler: createToolConfigurationHandler,
  });

  fastify.delete("/tool-configurations/:id", {
    handler: deleteToolConfigurationHandler,
  });
}

// routes/handlers.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createToolConfiguration,
  getAllToolConfigurations,
  getToolConfigurationById,
  deleteToolConfiguration,
} from "../usecase/tool-configuration";
import { KnowledgeBaseConfig } from "../domain/model/tool-configuration";

export interface CreateToolConfigurationRequest {
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
}

export const getAllToolConfigurationsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const configs = await getAllToolConfigurations({});
  reply.code(200).send({ success: true, data: configs });
};

export const getToolConfigurationByIdHandler = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const config = await getToolConfigurationById({
    id: request.params.id,
  });
  reply.code(200).send({ success: true, data: config });
};

export const createToolConfigurationHandler = async (
  request: FastifyRequest<{ Body: CreateToolConfigurationRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const config = await createToolConfiguration({
    request: request.body,
  });
  reply.code(201).send({ success: true, data: config });
};

export const deleteToolConfigurationHandler = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  await deleteToolConfiguration({ id: request.params.id });
  reply.code(200).send({ success: true });
};
```

### 2.2 既存Feature修正: `checklist`

#### 2.2.1 Model修正 (`domain/model/checklist.ts`)

```typescript
// CheckListItemDetailに追加
export interface CheckListItemDetail extends CheckListItemEntity {
  hasChildren: boolean;
  toolConfiguration?: {
    id: string;
    name: string;
  };
}

// CheckListItemDomainに追加
export const CheckListItemDomain = {
  // ... 既存メソッド

  fromPrismaCheckListItemWithDetail: (
    prismaItem: CheckList & {
      toolConfiguration?: { id: string; name: string } | null;
    },
    hasChildren: boolean
  ): CheckListItemDetail => {
    return {
      id: prismaItem.id,
      setId: prismaItem.checkListSetId,
      name: prismaItem.name,
      description: prismaItem.description ?? undefined,
      parentId: prismaItem.parentId ?? undefined,
      ambiguityReview: prismaItem.ambiguityReview
        ? {
            suggestions: (prismaItem.ambiguityReview as any).suggestions || [],
            detectedAt: new Date((prismaItem.ambiguityReview as any).detectedAt),
          }
        : undefined,
      hasChildren,
      toolConfiguration: prismaItem.toolConfiguration || undefined,
    };
  },
};
```

#### 2.2.2 Repository修正 (`domain/repository.ts`)

```typescript
// CheckRepository interfaceに追加
export interface CheckRepository {
  // ... 既存メソッド
  updateToolConfiguration(params: {
    checkId: string;
    toolConfigurationId: string | null;
  }): Promise<void>;
}

// makePrismaCheckRepository実装に追加

// findCheckListItems修正
const findCheckListItems = async (
  setId: string,
  parentId?: string,
  includeAllChildren?: boolean,
  ambiguityFilter?: AmbiguityFilter
): Promise<CheckListItemDetail[]> => {
  // ... 既存のwhereCondition

  const items = await client.checkList.findMany({
    where: whereCondition,
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      checkListSetId: true,
      documentId: true,
      ambiguityReview: true,
      toolConfiguration: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  if (items.length === 0) {
    return [];
  }

  // 子要素の有無を一括確認
  const itemIds = items.map((item) => item.id);
  const childItems = await client.checkList.findMany({
    where: {
      checkListSetId: setId,
      parentId: { in: itemIds },
    },
    select: { parentId: true },
  });

  const parentsWithChildren = new Set(childItems.map((child) => child.parentId));

  // fromPrismaCheckListItemWithDetailを使用
  return items.map((item) =>
    CheckListItemDomain.fromPrismaCheckListItemWithDetail(
      item,
      parentsWithChildren.has(item.id)
    )
  );
};

// updateToolConfiguration追加
const updateToolConfiguration = async (params: {
  checkId: string;
  toolConfigurationId: string | null;
}): Promise<void> => {
  await client.checkList.update({
    where: { id: params.checkId },
    data: { toolConfigurationId: params.toolConfigurationId },
  });
};

// return文に追加
return {
  // ... 既存メソッド
  updateToolConfiguration,
};
```

#### 2.2.3 Usecase追加 (`usecase/checklist-item.ts`に追加)

```typescript
export const assignToolConfiguration = async (params: {
  checkId: string;
  toolConfigurationId: string | null;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  await repo.updateToolConfiguration({
    checkId: params.checkId,
    toolConfigurationId: params.toolConfigurationId,
  });
};
```

#### 2.2.4 Routes & Handlers修正

```typescript
// routes/index.ts に追加
fastify.patch("/checklist-items/:checkId/tool-configuration", {
  handler: assignToolConfigurationHandler,
});

// routes/handlers.ts に追加
import { assignToolConfiguration } from "../usecase/checklist-item";

export const assignToolConfigurationHandler = async (
  request: FastifyRequest<{
    Params: { checkId: string };
    Body: { toolConfigurationId: string | null };
  }>,
  reply: FastifyReply
): Promise<void> => {
  await assignToolConfiguration({
    checkId: request.params.checkId,
    toolConfigurationId: request.body.toolConfigurationId,
  });
  reply.code(200).send({ success: true });
};
```

### 2.3 Review Workflow修正

#### 2.3.1 `pre-review-item.ts` 修正

```typescript
import { makePrismaToolConfigurationRepository } from "../../api/features/tool-configuration/domain/repository";

export async function preReviewItemProcessor(
  params: PreReviewItemParams
): Promise<any> {
  // ... 既存コード

  const checkList = await checkRepository.findCheckListItemById(checkId);

  // ツール設定を取得
  let toolConfiguration = null;
  if (checkList.toolConfigurationId) {
    const toolConfigRepo = await makePrismaToolConfigurationRepository();
    try {
      const config = await toolConfigRepo.findById(checkList.toolConfigurationId);
      toolConfiguration = {
        knowledgeBase: config.knowledgeBase,
        codeInterpreter: config.codeInterpreter,
        mcpConfig: config.mcpConfig,
      };
    } catch (error) {
      console.error(`Failed to fetch tool configuration: ${error}`);
    }
  }

  return {
    checkName: checkList.name,
    checkDescription: checkList.description || "",
    languageName: getLanguageName(userLanguage),
    documentPaths: documentsToProcess.map((doc) => doc.s3Path),
    documentIds: documentsToProcess.map((doc) => doc.id),
    toolConfiguration,
  };
}
```

**注**: CDK修正は不要。Lambda関数の環境変数やパラメータは変更なし。

### 2.4 API Index修正 (`backend/src/api/index.ts`)

```typescript
import { registerToolConfigurationRoutes } from "./features/tool-configuration/routes";

// registerRoutes関数内に追加
registerToolConfigurationRoutes(fastify);
```

## 3. Python Agent修正

### 3.1 型定義追加 (`review-item-processor/tools/factory.py`)

```python
from typing import Any, Dict, List, Optional, TypedDict

class KnowledgeBaseConfig(TypedDict):
    knowledgeBaseId: str
    dataSourceIds: Optional[List[str]]

class ToolConfiguration(TypedDict, total=False):
    knowledgeBase: Optional[List[KnowledgeBaseConfig]]
    codeInterpreter: bool
    mcpConfig: Optional[Any]
```

### 3.2 `tools/factory.py` 修正

```python
from typing import Any, Dict, List, Optional, TypedDict
from strands.types.tools import AgentTool
from tools.code_interpreter import create_code_interpreter_tool
from tools.knowledge_base import create_knowledge_base_tool
from logger import logger

class KnowledgeBaseConfig(TypedDict):
    knowledgeBaseId: str
    dataSourceIds: Optional[List[str]]

class ToolConfiguration(TypedDict, total=False):
    knowledgeBase: Optional[List[KnowledgeBaseConfig]]
    codeInterpreter: bool
    mcpConfig: Optional[Any]

def create_custom_tools(tool_config: Optional[ToolConfiguration] = None) -> List[AgentTool]:
    """
    Create custom tools based on configuration.
    
    Args:
        tool_config: Tool configuration from database
    
    Returns:
        List of enabled custom tools
    """
    tools = []
    
    if not tool_config:
        logger.debug("No tool configuration provided, returning empty tool list")
        return tools
    
    logger.debug(f"Creating tools with configuration: {tool_config}")
    
    # Code Interpreter
    if tool_config.get("codeInterpreter", False):
        code_tool = create_code_interpreter_tool()
        if code_tool:
            tools.append(code_tool)
            logger.debug("Enabled: Code Interpreter")
    
    # Knowledge Base
    kb_config = tool_config.get("knowledgeBase")
    if kb_config:
        kb_tool = create_knowledge_base_tool(kb_config)
        if kb_tool:
            tools.append(kb_tool)
            logger.debug(f"Enabled: Knowledge Base with {len(kb_config)} KB(s)")
            for kb in kb_config:
                logger.debug(f"  - KB ID: {kb['knowledgeBaseId']}, Data Sources: {kb.get('dataSourceIds', 'All')}")
    
    # MCP Config
    mcp_config = tool_config.get("mcpConfig")
    if mcp_config:
        logger.debug(f"MCP Config present: {mcp_config}")
    
    logger.info(f"Created {len(tools)} custom tool(s) from configuration")
    return tools
```

### 3.3 `tools/knowledge_base.py` 修正

```python
from typing import Any, Dict, List, Optional, TypedDict
from logger import logger

class KnowledgeBaseConfig(TypedDict):
    knowledgeBaseId: str
    dataSourceIds: Optional[List[str]]

def create_knowledge_base_tool(config: List[KnowledgeBaseConfig]) -> Optional[AgentTool]:
    """
    Create knowledge base query tool with dynamic configuration.
    
    Args:
        config: Knowledge base configuration from tool settings
    
    Returns:
        Knowledge base tool function or None if no configuration
    """
    if not config:
        logger.debug("No knowledge base configuration, skipping tool creation")
        return None
    
    # クロージャーでconfigをキャプチャ
    kb_config = config
    
    @tool
    def knowledge_base_query(query: str, max_results_per_kb: int = 5) -> dict:
        """Query Bedrock Knowledge Bases to retrieve relevant information."""
        try:
            bedrock_agent_runtime = boto3.client(
                "bedrock-agent-runtime", region_name=AWS_REGION
            )
            all_results = []

            for kb in kb_config:
                kb_id = kb.get("knowledgeBaseId")
                data_source_ids = kb.get("dataSourceIds", [])

                if not kb_id:
                    logger.warning("Skipping KB config without knowledgeBaseId")
                    continue

                try:
                    retrieval_config = {
                        "vectorSearchConfiguration": {"numberOfResults": max_results_per_kb}
                    }

                    if data_source_ids:
                        retrieval_config["vectorSearchConfiguration"]["filter"] = {
                            "in": {
                                "key": "x-amz-bedrock-kb-data-source-id",
                                "value": data_source_ids,
                            }
                        }

                    response = bedrock_agent_runtime.retrieve(
                        knowledgeBaseId=kb_id,
                        retrievalQuery={"text": query},
                        retrievalConfiguration=retrieval_config,
                    )

                    for result in response.get("retrievalResults", []):
                        content = result.get("content", {})
                        location = result.get("location", {})
                        score = result.get("score", 0.0)

                        all_results.append({
                            "knowledgeBaseId": kb_id,
                            "text": content.get("text", ""),
                            "score": score,
                            "location": _format_location(location),
                            "metadata": result.get("metadata", {}),
                        })

                    logger.debug(f"Retrieved {len(response.get('retrievalResults', []))} results from KB {kb_id}")

                except Exception as e:
                    logger.error(f"Error querying KB {kb_id}: {e}")
                    all_results.append({"knowledgeBaseId": kb_id, "error": str(e)})

            all_results.sort(key=lambda x: x.get("score", 0), reverse=True)

            return {
                "status": "success",
                "content": [{"json": {"query": query, "totalResults": len(all_results), "results": all_results}}],
            }

        except Exception as e:
            error_msg = f"Knowledge base query failed: {str(e)}"
            logger.error(error_msg)
            return {
                "status": "error",
                "content": [{"text": f"An error occurred during knowledge base query: {str(e)}"}],
            }
    
    try:
        logger.info(f"Creating knowledge base query tool with {len(config)} KB(s)")
        return knowledge_base_query
    except Exception as e:
        logger.error(f"Failed to create knowledge base tool: {e}")
        return None

# _format_location関数は既存のまま
```

### 3.4 `agent.py` 修正

```python
from typing import Any, Dict, List, Optional
from tools.factory import create_custom_tools, ToolConfiguration

def _run_strands_agent_legacy(
    prompt: str,
    file_paths: List[str],
    model_id: str = DOCUMENT_MODEL_ID,
    system_prompt: str = "You are an expert document reviewer.",
    temperature: float = 0.0,
    base_tools: Optional[List[Any]] = None,
    toolConfiguration: Optional[ToolConfiguration] = None,
) -> Dict[str, Any]:
    """Run Strands agent with traditional file_read approach"""
    logger.debug(f"Running Strands agent with {len(file_paths)} files")
    logger.debug(f"Tool configuration: {toolConfiguration}")
    
    meta_tracker = ReviewMetaTracker(model_id)
    history_collector = ToolHistoryCollector(truncate_length=TOOL_TEXT_TRUNCATE_LENGTH)

    with ExitStack() as stack:
        # MCP tools (現状未実装)
        mcp_tools = []
        
        # Use provided base tools or default to file_read
        tools_to_use = base_tools if base_tools else [file_read]
        
        # Add custom tools based on configuration
        custom_tools = create_custom_tools(toolConfiguration)
        tools_to_use.extend(custom_tools)
        
        # Combine with MCP tools
        tools = tools_to_use + mcp_tools
        logger.debug(f"Total tools available: {len(tools)}")
        
        # ... 残りの既存コード

def _run_strands_agent_with_citations(
    prompt: str,
    file_paths: List[str],
    model_id: str = DOCUMENT_MODEL_ID,
    system_prompt: str = "You are an expert document reviewer.",
    temperature: float = 0.0,
    toolConfiguration: Optional[ToolConfiguration] = None,
) -> Dict[str, Any]:
    """Run Strands agent with citation support (PDF only)"""
    logger.debug(f"Running Strands agent with citations for {len(file_paths)} files")
    logger.debug(f"Tool configuration: {toolConfiguration}")
    
    meta_tracker = ReviewMetaTracker(model_id)
    history_collector = ToolHistoryCollector(truncate_length=TOOL_TEXT_TRUNCATE_LENGTH)

    with ExitStack() as stack:
        # MCP tools (現状未実装)
        mcp_tools = []
        
        # Citation mode: document-based, file_read not required
        tools = mcp_tools.copy()
        
        # Add custom tools based on configuration
        custom_tools = create_custom_tools(toolConfiguration)
        tools.extend(custom_tools)
        
        logger.debug(f"Total tools available: {len(tools)}")
        
        # ... 残りの既存コード

def _process_review_with_citations(
    document_bucket: str,
    document_paths: list,
    check_name: str,
    check_description: str,
    language_name: str = "日本語",
    model_id: str = DOCUMENT_MODEL_ID,
    local_file_paths: List[str] = None,
    toolConfiguration: Optional[ToolConfiguration] = None,
) -> Dict[str, Any]:
    """Citation-enabled processing path"""
    logger.debug("Using citation-enabled processing")
    
    prompt = _get_document_review_prompt_with_citations(
        language_name, check_name, check_description
    )
    
    system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."
    
    result = _run_strands_agent_with_citations(
        prompt=prompt,
        file_paths=local_file_paths,
        model_id=model_id,
        system_prompt=system_prompt,
        toolConfiguration=toolConfiguration,
    )
    
    result["reviewType"] = "PDF"
    return result

def _process_review_legacy(
    document_bucket: str,
    document_paths: list,
    check_name: str,
    check_description: str,
    language_name: str = "日本語",
    model_id: str = DOCUMENT_MODEL_ID,
    local_file_paths: List[str] = None,
    has_images: bool = False,
    toolConfiguration: Optional[ToolConfiguration] = None,
) -> Dict[str, Any]:
    """Traditional file_read processing path"""
    logger.debug("Using legacy file_read processing")
    
    if has_images:
        prompt = get_image_review_prompt(
            language_name, check_name, check_description, model_id
        )
        tools = [file_read, image_reader]
        review_type = "IMAGE"
    else:
        prompt = _get_document_review_prompt_legacy(
            language_name, check_name, check_description
        )
        tools = [file_read]
        review_type = "PDF"
    
    system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."
    
    result = _run_strands_agent_legacy(
        prompt=prompt,
        file_paths=local_file_paths,
        model_id=model_id,
        system_prompt=system_prompt,
        base_tools=tools,
        toolConfiguration=toolConfiguration,
    )
    
    result["reviewType"] = review_type
    return result

def process_review(
    document_bucket: str,
    document_paths: list,
    check_name: str,
    check_description: str,
    language_name: str = "日本語",
    model_id: str = DOCUMENT_MODEL_ID,
    toolConfiguration: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Main dispatcher"""
    logger.debug(f"Processing review for check: {check_name}")
    logger.debug(f"Tool configuration: {toolConfiguration}")
    
    # ... 既存のファイルダウンロード処理
    
    # Citation decision logic
    use_citations = _should_use_citations(document_paths, selected_model_id, has_images)
    logger.debug(f"Citation usage decision: {use_citations}")
    
    # Dispatch to appropriate processing method
    if use_citations:
        result = _process_review_with_citations(
            document_bucket,
            document_paths,
            check_name,
            check_description,
            language_name,
            selected_model_id,
            local_file_paths,
            toolConfiguration,
        )
    else:
        result = _process_review_legacy(
            document_bucket,
            document_paths,
            check_name,
            check_description,
            language_name,
            selected_model_id,
            local_file_paths,
            has_images,
            toolConfiguration,
        )
    
    # ... 既存の結果検証処理
    
    return result
```

### 3.5 `index.py` 修正

```python
@app.entrypoint
def handler(event, context):
    # ... 既存コード
    
    tool_configuration = event.get("toolConfiguration")
    logger.debug(f"[DEBUG LAMBDA] Tool configuration: {tool_configuration}")
    
    review_data = process_review(
        document_bucket=DOCUMENT_BUCKET,
        document_paths=document_paths,
        check_name=check_name,
        check_description=check_description,
        language_name=language_name,
        model_id=DOCUMENT_MODEL_ID,
        toolConfiguration=tool_configuration,
    )
    
    # ... 既存コード
```

### 3.6 Logger設定修正 (`logger.py`)

```python
import logging

# Global logger instance
_logger = logging.getLogger(__name__)
_logger.setLevel(logging.DEBUG)

def set_logger(logger):
    global _logger
    _logger = logger
    _logger.setLevel(logging.DEBUG)

class LoggerProxy:
    def __getattr__(self, name):
        return getattr(_logger, name)

logger = LoggerProxy()
```

## 4. Frontend実装

### 4.1 新規Feature: `tool-configuration`

#### ディレクトリ構造
```
frontend/src/features/tool-configuration/
├── types.ts
├── hooks/
│   ├── useToolConfigurationQueries.ts
│   └── useToolConfigurationMutations.ts
├── components/
│   ├── ToolConfigurationList.tsx
│   └── ToolConfigurationForm.tsx
├── pages/
│   ├── ToolConfigurationListPage.tsx
│   └── CreateToolConfigurationPage.tsx
└── index.ts
```

#### 4.1.1 Types (`types.ts`)

```typescript
export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

export interface ToolConfiguration {
  id: string;
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface CreateToolConfigurationRequest {
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
}
```

#### 4.1.2 Hooks

```typescript
// hooks/useToolConfigurationQueries.ts
import useSWR from "swr";
import { ToolConfiguration } from "../types";
import { fetcher } from "../../../utils/fetcher";

export const useToolConfigurations = () => {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: ToolConfiguration[];
  }>("/tool-configurations", fetcher);

  return {
    toolConfigurations: data?.data || [],
    isLoading,
    error,
    refetch: mutate,
  };
};

// hooks/useToolConfigurationMutations.ts
import { useState } from "react";
import { apiClient } from "../../../utils/apiClient";
import { CreateToolConfigurationRequest } from "../types";

export const useCreateToolConfiguration = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const createToolConfiguration = async (req: CreateToolConfigurationRequest) => {
    setStatus("loading");
    try {
      await apiClient.post("/tool-configurations", req);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      throw error;
    }
  };
  
  return { createToolConfiguration, status };
};

export const useDeleteToolConfiguration = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const deleteToolConfiguration = async (id: string) => {
    setStatus("loading");
    try {
      await apiClient.delete(`/tool-configurations/${id}`);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      throw error;
    }
  };
  
  return { deleteToolConfiguration, status };
};
```

#### 4.1.3 Components

**ToolConfigurationList.tsx**: チェックリスト一覧と同様のデザイン
- カード形式で表示
- 使用中のツール設定には鍵アイコン表示
- 削除ボタンは使用中の場合は無効化

**ToolConfigurationForm.tsx**: フォーム実装
- 名前(必須)、説明(任意)
- Knowledge Base設定: チェックボックス + KB ID/Data Source IDs入力
- Code Interpreter: チェックボックス
- MCP設定: チェックボックス + JSONテキストエリア
- 最低1つのツールが選択されていることを検証

#### 4.1.4 Pages

**ToolConfigurationListPage.tsx**: 一覧ページ
- 右上に「新規作成」ボタン
- ToolConfigurationListコンポーネントを使用

**CreateToolConfigurationPage.tsx**: 作成ページ
- Breadcrumb表示
- ToolConfigurationFormコンポーネントを使用

### 4.2 既存Feature修正: `checklist`

#### 4.2.1 Types修正 (`types.ts`)

```typescript
export interface CheckListItem {
  // ... 既存フィールド
  toolConfiguration?: {
    id: string;
    name: string;
  };
}
```

#### 4.2.2 Hooks追加

```typescript
// hooks/useCheckListItemMutations.ts に追加
export const useAssignToolConfiguration = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const assignToolConfiguration = async (checkId: string, toolConfigId: string | null) => {
    setStatus("loading");
    try {
      await apiClient.patch(`/checklist-items/${checkId}/tool-configuration`, {
        toolConfigurationId: toolConfigId,
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      throw error;
    }
  };
  
  return { assignToolConfiguration, status };
};
```

#### 4.2.3 Components修正

**CheckListItemTree.tsx**:
- リーフノードにチェックボックスと「ツール付与」ボタン追加
- ツール設定が割り当てられている場合、タイトル右にツール設定名を表示(クリック可能)
- AssignToolConfigModalコンポーネント追加

```typescript
const AssignToolConfigModal = ({
  isOpen,
  onClose,
  onAssign,
  currentConfigId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (configId: string | null) => void;
  currentConfigId?: string;
}) => {
  const { toolConfigurations } = useToolConfigurations();
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("toolConfiguration.assign")}>
      <div className="space-y-2">
        {toolConfigurations.map((config) => (
          <button
            key={config.id}
            onClick={() => onAssign(config.id)}
            className={`w-full rounded-md border p-4 text-left hover:bg-aws-squid-ink-hover-light ${
              currentConfigId === config.id ? "border-aws-sea-blue-light" : ""
            }`}>
            <div className="font-semibold">{config.name}</div>
            {config.description && (
              <div className="text-sm text-aws-font-color-secondary-light">
                {config.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
};
```

### 4.3 Sidebar修正 (`components/Sidebar.tsx`)

```typescript
<li className="mb-1">
  <Link
    to="/tool-configurations"
    className={`flex items-center rounded-md px-4 py-3 transition-colors ${
      isActive("/tool-configurations")
        ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
        : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
    }`}
    onClick={() => setIsOpen(false)}>
    <HiWrench className="mr-3 h-5 w-5" />
    {t("sidebar.toolConfiguration")}
  </Link>
</li>
```

### 4.4 Routes修正 (`App.tsx`)

```typescript
import {
  ToolConfigurationListPage,
  CreateToolConfigurationPage,
} from "./features/tool-configuration";

// Routes内に追加
<Route path="tool-configurations" element={<ToolConfigurationListPage />} />
<Route path="tool-configurations/new" element={<CreateToolConfigurationPage />} />
```

## 5. マイグレーション

### 5.1 Prismaマイグレーション

```sql
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

-- AlterTable
ALTER TABLE `check_lists` ADD COLUMN `tool_configuration_id` VARCHAR(26) NULL;

-- CreateIndex
CREATE INDEX `idx_check_list_tool_config` ON `check_lists`(`tool_configuration_id`);

-- AddForeignKey
ALTER TABLE `check_lists` ADD CONSTRAINT `check_lists_tool_configuration_id_fkey` 
    FOREIGN KEY (`tool_configuration_id`) REFERENCES `tool_configurations`(`tool_configuration_id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

## 6. 実装順序

1. **Phase 1: Backend基盤**
   - Prismaスキーマ追加
   - マイグレーション実行
   - Tool Configuration feature実装 (domain, usecase, routes)

2. **Phase 2: Backend統合**
   - Checklist feature修正 (domain model, repository, usecase, routes)
   - Review workflow修正 (pre-review-item.ts)
   - API index修正

3. **Phase 3: Python Agent**
   - logger.py修正
   - tools/factory.py修正
   - tools/knowledge_base.py修正
   - agent.py修正
   - index.py修正

4. **Phase 4: Frontend基盤**
   - Tool Configuration feature実装 (types, hooks, components, pages)
   - Sidebar修正
   - Routes修正

5. **Phase 5: Frontend統合**
   - Checklist feature修正 (types, hooks, components)

6. **Phase 6: テスト・検証**
   - Backend unit tests
   - Frontend動作確認
   - E2Eテスト

## 7. 作成・修正ファイル一覧

### Backend
**新規作成:**
- `backend/prisma/migrations/YYYYMMDDHHMMSS_add_tool_configurations/migration.sql`
- `backend/src/api/features/tool-configuration/domain/model/tool-configuration.ts`
- `backend/src/api/features/tool-configuration/domain/repository.ts`
- `backend/src/api/features/tool-configuration/usecase/tool-configuration.ts`
- `backend/src/api/features/tool-configuration/routes/index.ts`
- `backend/src/api/features/tool-configuration/routes/handlers.ts`

**修正:**
- `backend/prisma/schema.prisma`
- `backend/src/api/features/checklist/domain/model/checklist.ts`
- `backend/src/api/features/checklist/domain/repository.ts`
- `backend/src/api/features/checklist/usecase/checklist-item.ts`
- `backend/src/api/features/checklist/routes/index.ts`
- `backend/src/api/features/checklist/routes/handlers.ts`
- `backend/src/review-workflow/review-preprocessing/pre-review-item.ts`
- `backend/src/api/index.ts`

### Python
**修正:**
- `review-item-processor/logger.py`
- `review-item-processor/tools/factory.py`
- `review-item-processor/tools/knowledge_base.py`
- `review-item-processor/agent.py`
- `review-item-processor/index.py`

### Frontend
**新規作成:**
- `frontend/src/features/tool-configuration/types.ts`
- `frontend/src/features/tool-configuration/hooks/useToolConfigurationQueries.ts`
- `frontend/src/features/tool-configuration/hooks/useToolConfigurationMutations.ts`
- `frontend/src/features/tool-configuration/components/ToolConfigurationList.tsx`
- `frontend/src/features/tool-configuration/components/ToolConfigurationForm.tsx`
- `frontend/src/features/tool-configuration/pages/ToolConfigurationListPage.tsx`
- `frontend/src/features/tool-configuration/pages/CreateToolConfigurationPage.tsx`
- `frontend/src/features/tool-configuration/index.ts`

**修正:**
- `frontend/src/App.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/features/checklist/types.ts`
- `frontend/src/features/checklist/hooks/useCheckListItemMutations.ts`
- `frontend/src/features/checklist/components/CheckListItemTree.tsx`

## 8. 重要な設計判断

### 8.1 Domain Model設計
- `CheckListItemDomain.fromPrismaCheckListItemWithDetail`を追加し、toolConfigurationとhasChildrenを一度に変換
- 既存の`fromPrismaCheckListItem`は維持し、後方互換性を保つ

### 8.2 Python型安全性
- TypedDictを使用してツール設定の型を定義
- グローバル変数の上書きを避け、クロージャーでconfigをキャプチャ

### 8.3 MCP設定
- agent.pyでmcpServersパラメータを削除し、toolConfiguration内のmcpConfigのみを使用
- 現状MCPは未実装のため、将来の拡張に備えた設計

### 8.4 削除制約
- `onDelete: Restrict`により、使用中のツール設定は削除不可
- フロントエンドで鍵アイコン表示し、削除ボタンを無効化

### 8.5 デフォルト動作
- ツール設定が指定されていない場合、すべてのツールを無効化(空のツールリスト)
- 既存の動作との互換性を保つため、toolConfigurationがnullの場合は空リストを返す

## 9. テスト観点

### 9.1 Backend
- ツール設定のCRUD操作
- 使用中のツール設定削除時のエラー
- チェック項目へのツール設定割り当て
- pre-review-itemでのツール設定取得

### 9.2 Python
- ツール設定なしの場合(空リスト)
- Code Interpreterのみ有効
- Knowledge Baseのみ有効
- 複数ツール有効
- 各ツールの設定内容がloggerに出力されること

### 9.3 Frontend
- ツール設定一覧表示
- ツール設定作成(バリデーション含む)
- 使用中ツール設定の削除不可表示
- チェック項目へのツール設定割り当て
- ツール設定名のクリックで詳細画面遷移
