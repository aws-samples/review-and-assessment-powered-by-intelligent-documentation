# CDK Step Functions Patterns

Reference for common CDK Step Functions patterns used in RAPID workflows.

## Data Flow with JsonPath

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
  "Payload.$": "$.Payload",
  "StatusCode.$": "$.StatusCode",
}
```

## State Machine Creation Pattern

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
