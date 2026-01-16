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
uv run python evals/scripts/run_eval.py --suite examples/quick_start_suite.json
```

You'll see metrics like:

- Accuracy: 100% (2/2 correct)
- Recall: 100% ⭐ (caught all issues)
- Critical Errors: 0 (safe for HITL)

**What just happened?** You tested an AI agent against 2 fire safety scenarios (~1-2 minutes). See "Core Concepts" below to understand what these metrics mean.

**Want more?** See the "Comprehensive Example" section below for a detailed 6-case walkthrough.

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

- **ECE (Expected Calibration Error)**: How well confidence matches actual accuracy

  - <0.10 = well calibrated
  - > 0.20 = can't trust confidence scores

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

## Comprehensive Example: Floor Plan Safety Evaluation

This example shows a complete evaluation workflow using the CLI with 6 test cases.

### Test Scenario

We're testing fire safety compliance across 6 building floor plans with varying evidence quality:

| Building | Scenario                                     | Expected Confidence |
| -------- | -------------------------------------------- | ------------------- |
| A        | Clear compliant evidence                     | High (0.90-1.0)     |
| B        | Clear violation evidence                     | High (0.90-1.0)     |
| C        | Vague compliant description                  | Low (0.45-0.60)     |
| D        | Incomplete information                       | Low (0.40-0.55)     |
| E        | Partial compliance                           | Medium (0.65-0.75)  |
| F        | Subtle violation (45 min vs 60 min required) | Critical test       |

**Purpose**: Test if agent can distinguish high-confidence correct answers from uncertain cases, and catch subtle violations.

### Files Used

- **Test suite**: `examples/floor_plan_hitl_suite.json` (6 test cases)
- **Document**: `examples/fixtures/floor_plan_safety_reports.pdf` (6 pages, one per building)
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
✓ Loaded 6 test cases from examples/floor_plan_hitl_suite.json
✓ Created experiment with 4 evaluators

🤖 Running agent evaluation...
  Processing case 1/6: FP001-building-a-clear-compliant...
  Processing case 2/6: FP002-building-b-clear-violation...
  Processing case 3/6: FP003-building-c-vague-compliant...
  Processing case 4/6: FP004-building-d-incomplete-info...
  Processing case 5/6: FP005-building-e-partial-compliance...
  Processing case 6/6: FP006-building-f-subtle-violation...

✓ Evaluation complete!
Results saved to: results/results_20250116_143022.json

=============================================================
ACCURACY METRICS
=============================================================
Accuracy:  83% (5/6 correct)
Recall:    100% ⭐ (caught all violations)
Precision: 80% (1 false positive)
F1 Score:  0.89

False Negatives: 0 (no missed violations - GOOD!)
False Positives: 1 (unnecessary review for Building C - acceptable)

=============================================================
CONFIDENCE CALIBRATION (HITL SAFETY)
=============================================================
ECE (Calibration Error):   0.083 (good - <0.10)
Brier Score:                0.120
Over-Confidence Rate:       16.7% (1/6 high-confidence wrong)
Critical Errors (FN@HC):    0 (no high-confidence false negatives)

✓ Safe Threshold:           0.85
  → Accuracy above threshold: 100%
  → FN rate above threshold:  0.0%
  → Use this for auto-approval in HITL systems
```

### Understanding Each Result

| Metric              | Value   | What It Means                                      | Is This Good?                      |
| ------------------- | ------- | -------------------------------------------------- | ---------------------------------- |
| **Accuracy**        | 83%     | Agent got 5 out of 6 predictions correct           | ✓ Good - most predictions accurate |
| **Recall**          | 100% ⭐ | Caught ALL real violations (0 false negatives)     | ✓ Excellent - safe for production  |
| **Precision**       | 80%     | 4 out of 5 "fail" predictions were real violations | ✓ Good - minimal false alarms      |
| **F1 Score**        | 0.89    | Balanced measure of precision & recall             | ✓ Strong overall performance       |
| **ECE**             | 0.083   | Confidence scores align well with accuracy         | ✓ Well-calibrated (<0.10 is good)  |
| **Brier Score**     | 0.120   | Combined accuracy & calibration quality            | ✓ Low is better (0.0 = perfect)    |
| **Over-Confidence** | 16.7%   | 1 out of 6 high-confidence predictions wrong       | ⚠️ Acceptable but monitor          |
| **Critical Errors** | 0       | No missed violations at high confidence            | ✓ Perfect - no dangerous errors    |

**Key Insight**: 100% recall with 0 critical errors means this agent is **safe for HITL deployment**. The 83% accuracy is acceptable because all mistakes were false positives (unnecessary human reviews), not missed violations.

### Understanding the Results

**Accuracy Metrics:**

- **83% overall accuracy**: Agent got 5 out of 6 predictions correct
- **100% recall** ⭐: Caught ALL real violations (most important metric!)
- **1 false positive**: Building C was flagged unnecessarily (agent was uncertain, so this is acceptable)

**What This Means for Production:**

- Agent won't miss critical safety violations
- Some safe buildings may go to human review (better safe than sorry)
- False positives are manageable - only 1 out of 6 cases

**Calibration Insights:**

- **High confidence (0.9+)** predictions were correct (Buildings A & B)
- **Low confidence (0.4-0.6)** appropriately expressed uncertainty (Buildings C & D)
- **Medium confidence (0.7)** showed mixed evidence (Building E)
- **ECE 0.083**: Well-calibrated - confidence scores match actual accuracy

**What This Means for HITL:**

- Can trust high-confidence predictions for auto-approval
- Low-confidence cases should go to human review
- Safe threshold of 0.85 means: predictions above 85% confidence are reliable

**Critical Safety Check:**

- **0 critical errors**: Agent never confidently missed a violation
- If this were >0, it would indicate dangerous over-confidence
- Building F test case validates agent can catch subtle violations

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

- **ECE (Expected Calibration Error)**

  - Measures how well confidence scores match actual accuracy
  - **Formula**: `ECE = (1/M) × Σ|accuracy(Bm) - confidence(Bm)|`
    - M = number of confidence bins (typically 10)
    - Bm = predictions in bin m
    - accuracy(Bm) = actual accuracy within bin
    - confidence(Bm) = average confidence within bin
  - **Example**:
    ```
    Bin [0.8-0.9]: 5 predictions, 4 correct
    accuracy(B) = 4/5 = 0.80
    confidence(B) = 0.85 (average)
    |0.80 - 0.85| = 0.05 (contribution to ECE)
    ```
  - Lower is better: <0.10 is good, <0.05 is excellent
  - **Why it matters**: You only want to trust high-confidence predictions if they're actually correct. Over-confident wrong predictions are dangerous in production HITL systems.

- **Brier Score**

  - Overall prediction quality metric (combines accuracy and calibration)
  - **Formula**: `Brier = (1/N) × Σ(confidence - truth)²`
    - N = number of predictions
    - confidence = predicted probability
    - truth = 1 if correct, 0 if wrong
  - **Example**:

    ```
    Prediction: "pass" with 0.9 confidence, actually pass
    (0.9 - 1)² = 0.01 (small penalty - good!)

    Prediction: "fail" with 0.8 confidence, actually pass
    (0.8 - 0)² = 0.64 (high penalty - bad!)
    ```

  - Lower is better: 0.0 = perfect, 1.0 = worst
  - Penalizes both incorrect predictions and poor confidence calibration

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

| Metric          | Good  | Warning | Action                                              |
| --------------- | ----- | ------- | --------------------------------------------------- |
| Recall          | >95%  | <90%    | ⚠️ Improve check_description, add training examples |
| Precision       | >80%  | <70%    | ⚠️ Check_description may be too vague               |
| ECE             | <0.10 | >0.20   | ⚠️ Can't trust confidence scores                    |
| Critical Errors | 0     | >0      | 🚨 CRITICAL - Review immediately                    |

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

### Troubleshooting

**"ModuleNotFoundError: No module named 'strands_evals'"**

```bash
cd review-item-processor
uv sync --extra evals
```

---

**"Agent execution failed"**

Possible causes:

- AWS credentials not configured: Run `aws configure`
- Bedrock not accessible in your region
- Document paths incorrect

Check:

1. Verify AWS credentials: `aws sts get-caller-identity`
2. Verify Bedrock access in your region
3. Ensure document files exist in fixtures directory

---

**"FileNotFoundError: Document 'xyz.pdf' not found"**

- Make sure files are in `my_tests/fixtures/` or `examples/fixtures/`
- Use just the filename in test cases, not the full path
- ✅ Correct: `"document_paths": ["my_doc.pdf"]`
- ❌ Incorrect: `"document_paths": ["/full/path/my_doc.pdf"]`

---

**"No valid test cases" in metrics**

Check that:

- `expected_output.result` is either "pass" or "fail" (lowercase)
- Agent returned a valid result
- Run with `--verbose` to see detailed output

---

**Low Recall (<90%)**

Agent is missing violations. Try:

1. Make `check_description` more specific and detailed
2. Add examples of what to look for
3. Check if documents have poor quality (scanned images, etc.)
4. Review false negative cases to find patterns

---

**High False Positive Rate (Precision <70%)**

Agent flags too many non-issues. Try:

1. Make `check_description` more precise about pass criteria
2. Add clarifying examples
3. Check if ground truth labels are correct

---

**Critical Errors >0**

🚨 **CRITICAL**: Agent confidently missed violations

1. Review these cases immediately - they're the most dangerous
2. Understand why agent was confident but wrong
3. Update `check_description` to address these cases
4. Re-run evaluation to verify fix

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
