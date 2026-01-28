# RAPID Review Agent Evaluation

English | [日本語](./ja/README.md)

Quick evaluation framework for testing the review agent's accuracy, recall, and confidence calibration.

---

## Quick Start

Install dependencies:

```bash
cd review-item-processor
uv sync --extra evals
```

Run a pre-built demo to see it work:

```bash
uv run python evals/scripts/run_eval.py --suite examples/floor_plan_hitl_suite.json
```

You'll see metrics like:

- Accuracy: 100% (3/3 correct)
- Recall: 100% ⭐ (caught all violations)
- Critical Errors: 0 (safe for HITL)

**What just happened?** You tested an AI agent against 3 fire safety scenarios (~2-3 minutes). See "Core Concepts" below to understand what these metrics mean.

**Want more?** See the "Comprehensive Example" section below for a detailed walkthrough with explanation of each test case.

---

## Core Concepts

### About the Evaluation Framework

This evaluation system uses [strands-evals](https://github.com/strandslabs/strands-evals), an open-source framework for testing AI agents. It includes multiple evaluator types: **accuracy checking** (exact match), **confidence calibration** (how well confidence scores align with actual accuracy), **LLM-as-judge** (where another AI evaluates output quality and explanations), and **faithfulness verification** (checks if answers are grounded in source documents). You'll see results from all evaluators after running tests.

### What is Evaluation?

Evaluation tests whether your AI agent makes correct decisions. Instead of manually checking every document, you:

1. Create test cases with known correct answers (ground truth)
2. Run the agent on those test cases
3. Compare agent's answers to ground truth
4. Calculate metrics to measure performance

### Why Evaluate?

Before deploying AI agents in production (especially for safety/compliance), you need confidence that they:

- Catch all critical issues (high recall)
- Don't flag too many false alarms (good precision)
- Know when they're uncertain (good calibration)

### Two Types of Metrics

**1. Accuracy Metrics - Is the agent RIGHT?**

- **Recall** ⭐ (Most Important): % of real issues the agent caught

  - Example: If there are 10 violations and agent finds 9, recall = 90%
  - For safety/compliance, aim for >95%

- **Precision**: % of agent's flags that are real issues

  - Example: If agent flags 10 items but only 8 are real issues, precision = 80%
  - Lower precision = more unnecessary human reviews (acceptable tradeoff)

- **Accuracy**: Overall correctness (correct predictions / total predictions)

**2. Calibration Metrics - Does the agent KNOW when it's right?**

- **Confidence**: Agent's self-assessment score (0.0 to 1.0)

  - 0.9+ = very confident
  - 0.5-0.7 = uncertain
  - <0.5 = very uncertain

- **Over-Confidence Rate**: Percentage of high-confidence predictions that are wrong

  - Should be close to 0%
  - High rate = agent is dangerously over-confident

- **Critical Errors (FN@HC)**: False negatives at HIGH confidence
  - This is MOST DANGEROUS - agent confidently misses violations
  - Must be 0 for production HITL systems

### Visual Example

```
Document: Fire extinguisher missing (violation)
Expected: FAIL
Agent says: FAIL with 95% confidence

✓ Correct prediction (contributes to recall)
✓ Appropriate high confidence (good calibration)
```

**Next:** See a comprehensive example with real CLI workflow in the next section →

---

## Agent Prompt Evaluation

### Target Audience

This eval framework is primarily designed for **technical users** (AI/ML Engineer, System Developer).

**Workflow**:

1. Design system prompts in agent.py (role definition, output format, confidence guidelines, critical rules)
2. Run evals to test prompt variations
3. Analyze metrics (recall, precision, critical errors)
4. Improve prompts until production standards are met
5. Release the agent

**Note**: Non-technical users typically don't need to run evals. Use the agent as tuned by the technical team.

### What Are We Evaluating?

This evaluation framework assesses **prompt quality in agent.py**. Specifically:

#### Prompts Defined in agent.py

`agent.py` contains multiple prompt functions:

- System prompt
- Document review agent prompt
- Image review agent prompt

#### Elements Included in Each Prompt

Prompts include these elements:

- **Role Definition**:

  - Document: "You are an expert document reviewer"
  - Image: "You are an AI assistant who reviews images"

- **Output Format**:

  - JSON schema with required fields
  - Language specification

- **Confidence Guidelines**:

  - 0.90-1.00: Clear evidence found, obvious compliance/non-compliance
  - 0.70-0.89: Relevant evidence with some uncertainty
  - 0.50-0.69: Ambiguous evidence, significant uncertainty
  - 0.30-0.49: Insufficient evidence for determination

- **Critical Rules**:
  - `BASE_JUDGMENT_ON_DOCUMENTS_ONLY`: Base judgment only on provided documents
  - `INSUFFICIENT_INFORMATION_HANDLING`: How to handle insufficient information

#### check_description (User Prompt)

Beyond agent.py prompts, test cases specify concrete check instructions:

```json
{
  "check_name": "Fire Extinguisher Installation Check",
  "check_description": "Verify that 2 or more ABC-type fire extinguishers are installed in the 1st floor hallway and are within valid date"
}
```

---

## Comprehensive Example: Floor Plan Safety Evaluation

This example shows a complete evaluation workflow using the CLI with 3 test cases.

### Test Scenario

We're testing fire safety compliance with 3 essential test cases covering different evidence scenarios:

| Test Case | Check Type                 | Expected Result | Purpose                                       |
| --------- | -------------------------- | --------------- | --------------------------------------------- |
| TC001     | Fire extinguisher presence | PASS            | High-confidence pass (clear compliance)       |
| TC002     | Emergency light backup     | FAIL            | High-confidence fail (clear violation)        |
| TC004     | Sprinkler system presence  | FAIL            | Evidence absent (information not in document) |

**Purpose**: Test if agent can handle clear compliance, clear violations, and cases where evidence is absent from documents.

### Files Used

- **Test suite**: `examples/floor_plan_hitl_suite.json` (3 test cases)
- **Document**: `examples/fixtures/floor_plan_safety_reports.pdf` (Building A safety report on page 1)
- **Ground truth**: Pre-determined pass/fail labels in the test suite

### Running the Evaluation

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py \
  --suite examples/floor_plan_hitl_suite.json \
  --experiment comprehensive
```

### Expected Output

```
✓ Loaded 3 test cases from examples/floor_plan_hitl_suite.json
✓ Created experiment with 4 evaluators

🤖 Running agent evaluation...
  Processing case 1/3: TC001-high-confidence-pass...
  Processing case 2/3: TC002-high-confidence-fail...
  Processing case 3/3: TC004-evidence-absent...

✓ Evaluation complete!
Results saved to: results/results_20250122_143022.json

=============================================================
ACCURACY METRICS
=============================================================
Accuracy:  100% (3/3 correct)
Recall:    100% ⭐ (caught all violations)
Precision: 100%
F1 Score:  1.00

False Negatives: 0 (no missed violations - GOOD!)
False Positives: 0 (no unnecessary reviews - EXCELLENT!)

=============================================================
CONFIDENCE CALIBRATION (HITL SAFETY)
=============================================================
Over-Confidence Rate:       0.0% (0/3 high-confidence wrong)
Critical Errors (FN@HC):    0 (no high-confidence false negatives)

✓ Safe Threshold:           0.85
  → Accuracy above threshold: 100%
  → FN rate above threshold:  0.0%
  → Use this for auto-approval in HITL systems
```

### Understanding Each Result

| Metric              | Value   | What It Means                                  | Is This Good?                       |
| ------------------- | ------- | ---------------------------------------------- | ----------------------------------- |
| **Accuracy**        | 100%    | Agent got all 3 predictions correct            | ✓ Perfect - all predictions correct |
| **Recall**          | 100% ⭐ | Caught ALL real violations (0 false negatives) | ✓ Excellent - safe for production   |
| **Precision**       | 100%    | All "fail" predictions were real violations    | ✓ Perfect - no false alarms         |
| **F1 Score**        | 1.00    | Balanced measure of precision & recall         | ✓ Perfect performance               |
| **Over-Confidence** | 0.0%    | No high-confidence predictions were wrong      | ✓ Perfect - well calibrated         |
| **Critical Errors** | 0       | No missed violations at high confidence        | ✓ Perfect - no dangerous errors     |

**Key Insight**: 100% recall with 0 critical errors means this agent is **safe for HITL deployment**. All predictions were accurate with no false positives or false negatives.

### Understanding the Results

**Accuracy Metrics:**

- **100% overall accuracy**: Agent got all 3 predictions correct
- **100% recall** ⭐: Caught ALL real violations (most important metric!)
- **0 false positives**: No unnecessary flagging
- **0 false negatives**: No missed violations

**What This Means for Production:**

- Agent correctly handles clear compliance cases (TC001)
- Agent correctly identifies clear violations (TC002)
- Agent appropriately handles cases where evidence is absent (TC004)

**Calibration Insights:**

- **TC001 (high-confidence pass)**: Agent correctly identified clear compliance evidence
- **TC002 (high-confidence fail)**: Agent correctly identified violation (90 min backup < 120 min required)
- **TC004 (evidence absent)**: Agent correctly reported low confidence when sprinkler information was not in document
- **Over-Confidence Rate 0.0%**: No high-confidence predictions were wrong (perfect calibration)

**What This Means for HITL:**

- Can trust high-confidence predictions for auto-approval
- Low-confidence cases appropriately go to human review
- Safe threshold of 0.85 means: predictions above 85% confidence are reliable

**Critical Safety Check:**

- **0 critical errors**: Agent never confidently missed a violation
- All test cases passed successfully
- Agent demonstrates appropriate handling of clear evidence and absent evidence scenarios

### Next Steps

Ready to test your own documents? See "How to Customize" section below.

---

## How to Customize: Testing Your Own Documents

Follow these steps to create and run evaluations on your own documents.

### Step 1: Prepare Your Test Document

Copy your PDF to the fixtures directory:

```bash
cp your_document.pdf evals/my_tests/fixtures/
```

**Supported formats**: PDF (primary, with citation support), PNG, JPG

### Step 2: Create Test Case Definition

Copy the template and edit it:

```bash
cp evals/my_tests/template.json evals/my_tests/my_suite.json
```

Edit `my_tests/my_suite.json`:

```json
{
  "name": "my-fire-safety-check",
  "input": {
    "document_paths": ["your_document.pdf"],
    "check_name": "Fire Extinguisher Check",
    "check_description": "Verify that fire extinguishers are installed and properly maintained according to safety standards",
    "language_name": "English"
  },
  "expected_output": {
    "result": "pass"
  }
}
```

**Required fields**:

- `name`: Unique identifier for this test case
- `document_paths`: Array of document filenames (just filename, not full path)
- `check_name`: Short name for what you're checking
- `check_description`: Detailed description of the requirement
- `language_name`: "English" or "日本語"
- `expected_output.result`: Your ground truth - "pass" or "fail"

**Optional fields**:

- `metadata`: Any additional info (category, criticality, etc.)
- `tool_configuration`: For advanced use cases (see References section)

### Step 3: Determine Ground Truth

**YOU must decide the correct answer** by reading the document:

1. Read the document carefully
2. Check it against the requirement in `check_description`
3. Decide: "pass" (compliant) or "fail" (non-compliant)

**Examples**:

- Document shows fire extinguisher installed → `"result": "pass"`
- Document missing required safety equipment → `"result": "fail"`
- Partial compliance → `"result": "fail"` (flag for human review)

**Important**: Ground truth is what the answer SHOULD be, not what you think the agent will say.

### Step 4: Run Evaluation

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json
```

You'll see output similar to the comprehensive example above.

### Step 5: Interpret Your Results

**Focus on these key metrics**:

- **Recall**: Did the agent catch all violations?

  - Target: >95% for safety/compliance
  - If low: Review false negatives, improve check_description

- **Precision**: How many flags are real issues?

  - Target: >80% (some false positives acceptable)
  - If low: Check if check_description is too vague

- **Critical Errors**: Any high-confidence false negatives?
  - Target: 0 (must be zero for production)
  - If >0: CRITICAL - review these cases immediately

### Step 6: Add More Test Cases

Create a test suite by making the JSON an array:

```json
[
  {
    "name": "test-case-1",
    "input": {
      "document_paths": ["doc1.pdf"],
      "check_name": "Fire Extinguisher Check",
      "check_description": "...",
      "language_name": "English"
    },
    "expected_output": { "result": "pass" }
  },
  {
    "name": "test-case-2",
    "input": {
      "document_paths": ["doc2.pdf"],
      "check_name": "Emergency Exit Check",
      "check_description": "...",
      "language_name": "English"
    },
    "expected_output": { "result": "fail" }
  }
]
```

**Recommendation**: Start with 5-10 test cases to get meaningful metrics.

### Step 7: Save and Review Results

Results are automatically saved to `results/results_TIMESTAMP.json`.

To see detailed per-case results, run with `--verbose`:

```bash
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --verbose
```

---

## References

### Metric Definitions

#### Accuracy Metrics

- **Recall** ⭐ **PRIMARY METRIC**

  - % of real issues the agent caught
  - Formula: True Positives / (True Positives + False Negatives)
  - **Why it matters**: In safety/compliance, missing a real issue (false negative) is much worse than flagging a non-issue (false positive). A false positive goes to human review; a false negative might be missed entirely.
  - Target: >95% for safety/compliance applications

- **Precision**

  - % of agent's flags that are real issues
  - Formula: True Positives / (True Positives + False Positives)
  - Lower precision = more unnecessary human reviews (acceptable tradeoff for high recall)
  - Target: >80%

- **Accuracy**

  - Overall correctness
  - Formula: (True Positives + True Negatives) / Total Cases
  - Target: >90%

- **F1 Score**
  - Harmonic mean of precision and recall
  - Formula: 2 × (Precision × Recall) / (Precision + Recall)
  - Balanced metric when both precision and recall matter

#### Calibration Metrics (HITL Safety)

- **Over-Confidence Rate**

  - % of high-confidence predictions (>0.85) that are wrong
  - **Formula**: `OCR = FP_high / Total_high`
    - FP_high = wrong predictions with confidence > 0.85
    - Total_high = all predictions with confidence > 0.85
  - **Example**:
    ```
    6 high-confidence predictions (>0.85)
    1 wrong = OCR = 1/6 = 16.7%
    ```
  - Should be close to 0%
  - If high: Agent is dangerously over-confident

- **Critical Errors (FN@HC)**

  - False negatives at HIGH confidence (>0.85)
  - **Definition**: Count of predictions where:
    - Expected result: FAIL (violation exists)
    - Agent result: PASS (missed it!)
    - Agent confidence: > 0.85 (very confident in wrong answer)
  - **Example**:
    ```
    Document has fire code violation (ground truth: FAIL)
    Agent says: PASS with 0.90 confidence
    → This is a CRITICAL ERROR (dangerous miss!)
    ```
  - **MOST DANGEROUS ERROR TYPE** - agent confidently misses violations
  - Must be 0 for production HITL systems

- **Safe Threshold**
  - Recommended confidence level for auto-approval
  - Calculated to maximize accuracy while minimizing false negative rate
  - Use this threshold to decide when to trust agent vs. send to human review

#### Interpreting Your Results

| Metric          | Good | Warning | Action                                              |
| --------------- | ---- | ------- | --------------------------------------------------- |
| Recall          | >95% | <90%    | ⚠️ Improve check_description, add training examples |
| Precision       | >80% | <70%    | ⚠️ Check_description may be too vague               |
| Critical Errors | 0    | >0      | 🚨 CRITICAL - Review immediately                    |

### CLI Options Reference

#### run_eval.py

Run evaluations from the command line:

```bash
uv run python evals/scripts/run_eval.py [OPTIONS]
```

**Options:**

- `--suite <path>` - Run test suite (JSON file with array of test cases)

  - Example: `--suite my_tests/my_suite.json`

- `--case <path>` - Run single test case (JSON file with single test case)

  - Example: `--case my_tests/single_case.json`

- `--experiment <type>` - Choose experiment type:

  - `accuracy` - Accuracy + calibration metrics only (fast)
  - `tool` - Add tool usage efficiency metrics
  - `comprehensive` - All metrics including explanation quality (default)

- `--output <path>` - Save results to specific file

  - Default: `results/results_TIMESTAMP.json`
  - Example: `--output my_results.json`

- `--verbose` - Show detailed output for each test case
  - Displays agent output, confidence, explanations
  - Useful for debugging false negatives/positives

**Examples:**

```bash
# Run comprehensive evaluation (default)
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json

# Run with verbose output
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --verbose

# Run single test case
uv run python evals/scripts/run_eval.py --case my_tests/single_case.json

# Run accuracy-only (faster)
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --experiment accuracy
```

### Advanced Topics

#### Tool Configuration (External Knowledge Bases)

Most evaluations don't need external tools - just PDF + check description is sufficient. However, for checks requiring external references (building codes, standards, regulations), you can configure knowledge base tools.

**IMPORTANT**: `knowledgeBase` is a **LIST**, not a single object!

**Example with Knowledge Base:**

```json
{
  "name": "advanced-kb-check",
  "input": {
    "document_paths": ["your_document.pdf"],
    "check_name": "Fire Safety Code Compliance",
    "check_description": "Verify compliance with local fire safety codes",
    "language_name": "English",
    "tool_configuration": {
      "knowledgeBase": [
        {
          "knowledgeBaseId": "YOUR_KB_ID",
          "dataSourceIds": null
        }
      ],
      "codeInterpreter": false,
      "mcpConfig": null
    }
  },
  "expected_output": { "result": "pass" }
}
```

**Multiple Knowledge Bases:**

```json
"tool_configuration": {
  "knowledgeBase": [
    {"knowledgeBaseId": "KB-regulations", "dataSourceIds": null},
    {"knowledgeBaseId": "KB-standards", "dataSourceIds": ["src-1"]}
  ]
}
```

**Using Tool Configuration with CLI:**

1. Save the above test case to `my_tests/compliance_with_kb.json` (replace `YOUR_KB_ID` with your actual knowledge base ID)
2. Run it:
   ```bash
   cd review-item-processor
   uv run python evals/scripts/run_eval.py --case my_tests/compliance_with_kb.json
   ```

See `my_tests/template.json` for detailed field documentation with inline comments.
