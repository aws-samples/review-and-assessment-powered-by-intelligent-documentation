---
name: modify-cdk-workflows
description: Modify CDK Step Functions workflows (ReviewProcessor and ChecklistProcessor) for the RAPID application, including workflow step changes, Map State concurrency, retry/timeout configuration, error handling, and parameter updates. Use when changing workflow step sequences, adjusting concurrency, modifying retry logic, or adding/removing workflow steps.
---

# Modify CDK Step Functions Workflows

## Workflow Architecture

```
cdk/lib/constructs/
├── review-processor.ts         # Review workflow (3-step)
├── checklist-processor.ts      # Checklist workflow (5-step)
├── agent.ts                    # AgentCore infrastructure
└── lambda/invoke-agent/        # Agent invocation Lambda
```

### ReviewProcessor Flow
1. **Prepare Review** - Fetch checklist items
2. **Process All Items** (Map State) - Parallel: pre-process -> AgentCore -> post-process
3. **Finalize Review** - Aggregate results

Config: `maxConcurrency` default 1, timeout 2 hours

### ChecklistProcessor Flow
1. **Process Document** - File format detection, page extraction
2. **Process All Pages Inline** (Map State) - Parallel page processing
3. **Aggregate Results** - Combine page results
4. **Store to Database** - Persist findings
5. **Detect Ambiguity** - Identify ambiguities

Config: `inlineMapConcurrency` default 1, timeout 24 hours, thresholds: 40 pages (medium), 100 pages (large)

## Common Modifications

### 1. Adding/Removing Workflow Steps

```typescript
// Create task
const newTask = new tasks.LambdaInvoke(this, "NewTaskId", {
  lambdaFunction: processorLambda,
  payload: sfn.TaskInput.fromObject({
    action: "newAction",
    dataParam: sfn.JsonPath.stringAt("$.previous.result"),
  }),
  resultPath: "$.newResult",
  resultSelector: { "Payload.$": "$.Payload" },
});

// Add error handling
newTask.addCatch(handleErrorTask, {
  errors: ["States.ALL"],
  resultPath: "$.error",
});

// Chain into workflow
const definition = prepareTask.next(newTask).next(processTask).next(finalizeTask);
```

Look for `definitionBody: sfn.DefinitionBody.fromChainable()` in processor files.

### 2. Modifying Map State Concurrency

```typescript
const processItemsMap = new sfn.Map(this, "ProcessAllItems", {
  maxConcurrency: maxConcurrency,
  itemsPath: sfn.JsonPath.stringAt("$.prepareResult.Payload.checkItems"),
  resultPath: "$.processedItems",
});
```

Set via CDK parameters: `cdk deploy -c rapid.reviewMapConcurrency=5`

Trade-offs: Higher = faster but more cost/throttling. Lower = slower but predictable.

### 3. Adding Retry Logic

```typescript
task.addRetry({
  errors: ["RetryException", "ThrottlingException", "ServiceQuotaExceededException"],
  interval: cdk.Duration.seconds(2),
  maxAttempts: 5,
  backoffRate: 2,
});
```

### 4. Adding Parameters

1. Define in `parameter-schema.ts`: `reviewMapConcurrency: z.number().int().min(1).optional()`
2. Pass to construct in `rapid-stack.ts`
3. Use in construct constructor

### 5. Modifying Timeouts

Task: `timeout: cdk.Duration.minutes(15)`
State machine: `timeout: cdk.Duration.hours(2)`

For JsonPath patterns and state machine creation templates, see [references/CDK-PATTERNS.md](references/CDK-PATTERNS.md).

## Quick Reference

| Modification | Location | Search For |
|--------------|----------|------------|
| Review workflow steps | review-processor.ts | `definitionBody.fromChainable` |
| Checklist workflow steps | checklist-processor.ts | `definitionBody.fromChainable` |
| Map State concurrency | Both processor files | `new sfn.Map` |
| Retry logic | Task definitions | `.addRetry` |
| Error handling | Task definitions | `.addCatch` |
| Parameters | parameter-schema.ts | `z.number()`, `z.boolean()` |

## Verification

```bash
cd cdk && npx cdk synth
```

After verification, deploy with `/deploy-cdk-stack`.

## Success Criteria

- `cdk synth` completes without errors
- No circular dependencies
- All tasks have proper error handling
- Concurrency and timeout settings are appropriate
