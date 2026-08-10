# Your Test Workspace

This is where you create your own evaluation test cases.

## Quick Start

### 1. Copy the Template
```bash
cp template.json my_first_test.json
```

### 2. Add Your Document
Create the `fixtures/` directory (it is not tracked in git) and copy your document into it:
```bash
mkdir -p fixtures
cp /path/to/your/document.pdf fixtures/
```

### 3. Edit the Test Case
Open `my_first_test.json` and fill in:
- `document_paths`: Your PDF filename
- `check_name`: What you're checking
- `check_description`: Detailed requirement
- `expected_output.result`: "pass" or "fail" (YOU decide ground truth)

### 4. Run Your Test
Go to `review-item-processor/` and run the evaluation:
```bash
cd ../..
uv run python evals/scripts/run_eval.py --suite my_tests/my_first_test.json
```

## Need Inspiration?

Look at the working examples in the `../examples/` directory:
- `floor_plan_hitl_suite.json` - 6 test cases with varying confidence
- `fixtures/floor_plan_safety_reports.pdf` - Multi-page PDF example

## Directory Structure
```
my_tests/
├── README.md              ← This file
├── template.json          ← Copy this to start
├── your_suite.json        ← Your custom tests
└── fixtures/              ← Created in step 2
    └── your_document.pdf  ← Your test files
```

## Tips
1. Start with 1-2 test cases to verify everything works
2. You must manually determine ground truth (pass/fail)
3. Use clear check descriptions - they guide the AI
4. See main README.md for metric interpretation
