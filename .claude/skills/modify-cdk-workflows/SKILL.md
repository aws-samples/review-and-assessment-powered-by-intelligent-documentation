---
name: modify-cdk-workflows
description: Modify CDK Step Functions workflows for review and checklist processing
---

# Modify CDK Step Functions Workflows

This skill guides you through modifying CDK Step Functions workflows (ReviewProcessor and ChecklistProcessor).

## When to Use

- Changing workflow step sequences
- Adjusting Map State concurrency
- Modifying retry/timeout configurations
- Adding/removing workflow steps
- Changing error handling logic
- Parameter configuration updates
- Workflow orchestration changes

## When NOT to Use

- **Modifying agent prompts or behavior** → use `/modify-agent-prompts`
- **Backend API or database changes** → use `/plan-backend-frontend`
- **Simple builds or formatting** → use `/build-and-format`
- **Deploying to AWS** → use `/deploy-cdk-stack`

## Workflow Architecture Overview

```
cdk/lib/constructs/
├── review-processor.ts         # Review workflow (3-step pattern)
├── checklist-processor.ts      # Checklist workflow (5-step pattern)
├── agent.ts                    # AgentCore infrastructure
└── lambda/
    └── invoke-agent/           # Agent invocation Lambda
```

### ReviewProcessor Workflow

**Purpose**: Process review jobs with AI-powered analysis

**Flow**:
1. **Prepare Review** - Fetch checklist items
2. **Process All Items** (Map State) - Parallel processing:
   - Pre-processing (data prep)
   - AgentCore processing (AI analysis)
   - Post-processing (result storage)
3. **Finalize Review** - Aggregate results

**Key Configuration**:
- `maxConcurrency` - Controls parallel execution (default: 1)
- Timeout: 2 hours per execution
- Retry logic for throttling errors

### ChecklistProcessor Workflow

**Purpose**: Process documents with page-by-page LLM analysis

**Flow**:
1. **Process Document** - File format detection, page extraction
2. **Process All Pages Inline** (Map State) - Parallel page processing
3. **Aggregate Results** - Combine page results
4. **Store to Database** - Persist findings
5. **Detect Ambiguity** - Identify ambiguities

**Key Configuration**:
- `inlineMapConcurrency` - Concurrent page processing (default: 1)
- Document thresholds: 40 pages (medium), 100 pages (large)
- Timeout: 24 hours per execution

## Common Modification Patterns

### 1. Adding/Removing Workflow Steps

**Pattern**: Create task → Chain into workflow

**Step 1: Create Lambda Task**
```typescript
const newTask = new tasks.LambdaInvoke(this, "NewTaskId", {
  lambdaFunction: processorLambda,
  payload: sfn.TaskInput.fromObject({
    action: "newAction",
    dataParam: sfn.JsonPath.stringAt("$.previous.result"),
  }),
  resultPath: "$.newResult",
  resultSelector: { "Payload.$": "$.Payload" },
});
```

**Step 2: Add Error Handling**
```typescript
newTask.addCatch(handleErrorTask, {
  errors: ["States.ALL"],
  resultPath: "$.error",
});
```

**Step 3: Chain into Workflow**
```typescript
// Insert between existing steps
const definition = prepareTask
  .next(newTask)           // New step
  .next(processTask)       // Existing next step
  .next(finalizeTask);
```

**Key Files to Modify**:
- `review-processor.ts` or `checklist-processor.ts`
- Look for `definitionBody: sfn.DefinitionBody.fromChainable()`

### 2. Modifying Map State Concurrency

**ReviewProcessor Example**:

Find the Map State creation:
```typescript
const processItemsMap = new sfn.Map(this, "ProcessAllItems", {
  maxConcurrency: maxConcurrency,  // From constructor props
  itemsPath: sfn.JsonPath.stringAt("$.prepareResult.Payload.checkItems"),
  resultPath: "$.processedItems",
});
```

**Change via CDK Parameters**:
```bash
# Set during deployment
cdk deploy -c rapid.reviewMapConcurrency=5

# Or update parameter-schema.ts default
```

**ChecklistProcessor Example**:
```typescript
const inlineMapState = new sfn.Map(this, "ProcessAllPagesInline", {
  maxConcurrency: inlineMapConcurrency,  // From props
  itemsPath: sfn.JsonPath.stringAt("$.processingResult.Payload.pages"),
  resultPath: "$.processedPages",
});
```

**Trade-offs**:
- **Higher concurrency** = Faster, but more cost and potential throttling
- **Lower concurrency** = Slower, but more controlled and predictable

### 3. Adding Retry Logic

**Pattern**: Add retry to task with exponential backoff

```typescript
task.addRetry({
  errors: [
    "RetryException",
    "ThrottlingException",
    "ServiceQuotaExceededException",
    "TooManyRequestsException",
  ],
  interval: cdk.Duration.seconds(2),
  maxAttempts: 5,
  backoffRate: 2,  // 2s, 4s, 8s, 16s, 32s
});
```

**Error Types to Handle**:
- `States.TaskFailed` - Generic task failure
- `States.Timeout` - Task exceeded timeout
- `ThrottlingException` - AWS service throttling
- `RetryException` - Custom retry signal
- `States.ALL` - Catch all errors

**Where to Add**:
- After task creation
- Before chaining with `.next()`
- Search for existing `.addRetry()` calls as examples

### 4. Adding Error Handling

**Pattern**: Catch errors and route to error handler

```typescript
task.addCatch(errorHandlerTask, {
  errors: ["States.ALL"],       // or specific error types
  resultPath: "$.error",         // Where error info is stored
});
```

**Error Handler Task Example**:
```typescript
const handleError = new tasks.LambdaInvoke(this, "HandleError", {
  lambdaFunction: processorLambda,
  payload: sfn.TaskInput.fromObject({
    action: "handleError",
    executionId: sfn.JsonPath.stringAt("$$.Execution.Id"),
    error: sfn.JsonPath.stringAt("$.error"),
  }),
});
```

**Important**:
- Error info stored at `resultPath` location
- Can access via JsonPath in subsequent steps
- Error handler can fail workflow or continue

### 5. Parameter Configuration

**Add New Parameter**:

**Step 1**: Define in `parameter-schema.ts`:
```typescript
reviewMapConcurrency: z.number().int().min(1).optional()
  .describe("Review processor Map State concurrency (default: 1)")
```

**Step 2**: Pass to Construct in `rapid-stack.ts`:
```typescript
const reviewProcessor = new ReviewProcessor(this, "ReviewProcessor", {
  maxConcurrency: props.parameters.reviewMapConcurrency || 1,
  // ... other props
});
```

**Step 3**: Use in Construct:
```typescript
// In review-processor.ts constructor
constructor(scope: Construct, id: string, props: ReviewProcessorProps) {
  const maxConcurrency = props.maxConcurrency;
  // Use in Map State creation
}
```

### 6. Modifying Timeouts

**Task-Level Timeout**:
```typescript
const task = new tasks.LambdaInvoke(this, "TaskId", {
  lambdaFunction: lambda,
  timeout: cdk.Duration.minutes(15),  // Task timeout
});
```

**State Machine Timeout**:
```typescript
this.stateMachine = new sfn.StateMachine(this, "WorkflowName", {
  definitionBody: sfn.DefinitionBody.fromChainable(definition),
  timeout: cdk.Duration.hours(2),  // Overall workflow timeout
});
```

**Default Timeouts**:
- ReviewProcessor: 2 hours
- ChecklistProcessor: 24 hours
- Individual tasks: Varies by Lambda configuration

## Data Flow with JsonPath

**Common JsonPath Patterns**:

```typescript
// From execution input
sfn.JsonPath.stringAt("$$.Execution.Input.userId")

// From Map state item
sfn.JsonPath.stringAt("$$.Map.Item.Value.fieldName")

// From previous task result
sfn.JsonPath.stringAt("$.previousTask.Payload.field")

// Entire execution context
sfn.JsonPath.entirePayload
```

**Item Selector for Map State**:
```typescript
itemSelector: {
  "reviewJobId.$": "$.reviewJobId",
  "checkId.$": "$$.Map.Item.Value.checkId",
  "itemData.$": "$$.Map.Item.Value",
}
```

**Result Selector**:
```typescript
resultSelector: {
  "Payload.$": "$.Payload",  // Extract Lambda payload
  "StatusCode.$": "$.StatusCode",
}
```

## State Machine Creation Pattern

**Basic Structure**:

```typescript
// Create IAM role
const stateMachineRole = new iam.Role(this, "Role", {
  assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
});

// Grant permissions
stateMachineRole.addToPolicy(
  new iam.PolicyStatement({
    actions: ["bedrock:InvokeModel"],
    resources: ["*"],
  })
);

// Create log group
const logGroup = new logs.LogGroup(this, "LogGroup", {
  retention: logs.RetentionDays.ONE_WEEK,
});

// Define workflow
const definition = taskA.next(taskB).next(taskC);

// Create state machine
this.stateMachine = new sfn.StateMachine(this, "WorkflowName", {
  definitionBody: sfn.DefinitionBody.fromChainable(definition),
  role: stateMachineRole,
  timeout: cdk.Duration.hours(2),
  tracingEnabled: true,
  logs: {
    destination: logGroup,
    level: sfn.LogLevel.ALL,
    includeExecutionData: true,
  },
});
```

## Quick Reference

| Modification | Location | Search For |
|--------------|----------|------------|
| Review workflow steps | review-processor.ts | `definitionBody.fromChainable` |
| Checklist workflow steps | checklist-processor.ts | `definitionBody.fromChainable` |
| Map State concurrency | Both processor files | `new sfn.Map` |
| Retry logic | Task definitions | `.addRetry` |
| Error handling | Task definitions | `.addCatch` |
| Parameters | parameter-schema.ts | `z.number()`, `z.boolean()` |
| Timeouts | State machine creation | `timeout: cdk.Duration` |

## Troubleshooting

### Workflow Fails Immediately
- Check IAM permissions on state machine role
- Verify Lambda functions exist and are accessible
- Review CloudWatch Logs for state machine
- Check input payload matches expected format

### Map State Not Executing
- Verify `itemsPath` points to valid array
- Check array is not empty
- Review `itemSelector` JsonPath expressions
- Ensure `maxConcurrency` > 0

### Throttling Errors
- Reduce `maxConcurrency` value
- Add/adjust retry logic with backoff
- Check AWS service quotas
- Review concurrent execution limits

### Task Timeout
- Increase task timeout duration
- Check Lambda function timeout setting
- Review if processing is unexpectedly slow
- Consider breaking into smaller steps

### JsonPath Errors
- Verify path exists in payload
- Use `$.` for task result, `$$.` for context
- Check Map state item access pattern
- Test with sample execution data

## Verification Steps

1. **Synthesize CloudFormation**
```bash
cd cdk
cdk synth
```

2. **Check for Circular Dependencies**
- Review synth output for errors
- Verify all resources have valid dependencies

3. **Review Generated State Machine**
```bash
# Find state machine definition in cdk.out/
# Verify structure matches intent
```

4. **Test with Sample Execution**
- Deploy changes
- Trigger workflow with test data
- Monitor execution in Step Functions console
- Review CloudWatch logs

## Success Criteria

- [ ] cdk synth completes without errors
- [ ] No circular dependencies
- [ ] State machine definition looks correct
- [ ] All tasks have proper error handling
- [ ] Concurrency settings are appropriate
- [ ] Retry logic handles expected failures
- [ ] Timeouts are reasonable
- [ ] Workflow executes successfully with test data

## After Modification

1. Run `cdk synth` to validate changes
2. Review generated CloudFormation template
3. Run `/deploy-cdk-stack` to deploy changes
4. Test workflow with sample data
5. Monitor first few executions for issues
