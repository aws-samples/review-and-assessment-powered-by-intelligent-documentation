---
name: add-example
description: Add new example use cases to the Examples feature
---

# Add Example Use Case

Guide for adding new use cases to the Examples feature when contributors provide sample files.

## When to Use

Use this skill when:

- A contributor has provided PDF, PNG, or TXT files for a new use case
- You need to add a new example to the Examples page
- Files are ready to be added to the repository

## When NOT to Use

- **Modifying existing examples** → Manually edit files
- **Fixing UI/design issues** → Use `/plan-backend-frontend`
- **Modifying translations only** → Edit i18n files directly

## Prerequisites

Before starting, ensure you have:

- [ ] Use case files from contributor (PDF, PNG, TXT, etc.)
- [ ] Use case metadata: name, description, category
- [ ] Local development environment running
- [ ] Python (latest stable version) with uv package manager installed
- [ ] Thumbnail generation dependencies (see Phase 6)

---

## Step-by-Step Process

### Phase 1: Gather Information

Ask the user for the following information:

- **Use case name** (English or Japanese)
- **Use case description**
- **Category tags**: one or more tags
  - Available tags: See `ExampleTag` type in `frontend/src/features/examples/types/index.ts`
  - To add new tags: Follow Phase 6 instructions
- **Language**: `en` or `ja`
- **Files provided** with their types:
  - `checklist`: Checklist files
  - `review`: Documents to be reviewed
  - `knowledge`: Knowledge base/reference materials
- **Location** of files provided by contributor

### Phase 2: Prepare Files in Repository

1. Read `frontend/src/features/examples/data/examples-metadata.json`
2. Determine next available use case number:
   - Check existing IDs in the appropriate language array
   - Use `use_case_NNN` for English or `use_case_NNN_ja` for Japanese
3. Create directory structure:
   ```
   examples/{language}/use_case_NNN_descriptive_name/
   ```
4. Copy contributor files to the new directory
5. Organize by type if needed (subdirectories for knowledge base)
6. Use descriptive filenames

### Phase 3: PDF Design Strategy (Optional)

If your use case includes multiple PDF files, consider visual differentiation to improve user experience.

#### Design Principle

**Goal**: Create realistic and easy-to-understand samples

**Approach**:
- Understand the culture and conventions of the domain/industry/business
- Choose differentiation methods that feel natural in that context
- Avoid over-generalization

#### Differentiation Methods (Examples Only)

**Color Palette**: Align with domain conventions
**Layout**: Choose appropriate structure based on document type
**Headers/Footers**: Clearly indicate document information

#### Reference: Pharmaceutical Regulatory Documents

Design adopted in UC007 (one example):

| Document | Color | Layout | Reason |
|----------|-------|--------|--------|
| Checklist | Blue | Two-column table | Clear verification items |
| Clinical Evaluation | Green | Section headers | Emphasize hierarchy |
| Guidelines | Gray | Chapter structure | Identify reference materials |

Rationale: Pharmaceutical industry's culture of formality and reliability

**Important**: This is just one example. Other domains may require completely different approaches.

#### Implementation Examples

See `scripts/example_pdf_templates.py` for detailed implementation patterns.

### Phase 4: Generate GitHub URLs

For each file, construct the raw GitHub URL:

**Format:**

```
https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/examples/{lang}/{folder}/{file}
```

**Important**: Japanese characters MUST be URL-encoded:

- Use JavaScript: `encodeURIComponent(filename)`
- Example: `ユースケース001` → `%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9001`

### Phase 5: Update Metadata

Edit `frontend/src/features/examples/data/examples-metadata.json`:

1. Add new entry to the appropriate language array (`en` or `ja`)
2. Use this template:

```json
{
  "id": "use_case_NNN",
  "name": "Use Case Display Name",
  "tags": ["tag1", "tag2"],
  "description": "Detailed description of what this use case demonstrates",
  "hasKnowledgeBase": true,
  "files": [
    {
      "id": "checklist_NNN",
      "name": "checklist_file.pdf",
      "type": "checklist",
      "url": "https://raw.githubusercontent.com/.../checklist_file.pdf"
    },
    {
      "id": "review_NNN",
      "name": "review_file.png",
      "type": "review",
      "url": "https://raw.githubusercontent.com/.../review_file.png"
    }
  ]
}
```

3. Set `hasKnowledgeBase: true` only if knowledge files are included
4. Ensure JSON syntax is valid (commas, brackets)

### Phase 6: Add New Category Tags (if needed)

**Only if introducing NEW tags:**

Adding a new category tag requires updating three locations: type definition, UI components, and translations.

#### Step 1: Update TypeScript Type Definition

Edit `frontend/src/features/examples/types/index.ts`:

Add the new tag to the `ExampleTag` union type:

```typescript
export type ExampleTag =
  | "real-estate"
  | "it-department"
  | "manufacturing"
  | "sustainability"
  | "corporate-governance"
  | "your-new-tag";  // Add your tag here
```

#### Step 2: Update UI Components

**2a. Update TagFilter Component**

Edit `frontend/src/features/examples/components/TagFilter.tsx`:

Add the new tag with an appropriate emoji icon to the `tags` array:

```typescript
const tags: { value: ExampleTag; icon: string }[] = [
  { value: "real-estate", icon: "🏢" },
  { value: "it-department", icon: "💼" },
  { value: "manufacturing", icon: "🏭" },
  { value: "sustainability", icon: "🌱" },
  { value: "corporate-governance", icon: "📋" },
  { value: "your-new-tag", icon: "🎯" },  // Choose appropriate emoji
];
```

**2b. Update OnboardingModal Component**

Edit `frontend/src/features/examples/components/OnboardingModal.tsx`:

Add the new tag with the same emoji icon to the `industries` array:

```typescript
const industries = [
  { tag: "real-estate", icon: "🏢" },
  { tag: "it-department", icon: "💼" },
  { tag: "manufacturing", icon: "🏭" },
  { tag: "sustainability", icon: "🌱" },
  { tag: "corporate-governance", icon: "📋" },
  { tag: "your-new-tag", icon: "🎯" },  // Use same emoji as TagFilter
] as const;
```

**Important**: Use the same emoji icon in both components for consistency.

#### Step 3: Update Translations

Add translation keys to `frontend/src/i18n/locales/en.json`:

```json
"examples": {
  "tagNewTag": "New Tag Display Name"
}
```

Add translation keys to `frontend/src/i18n/locales/ja.json`:

```json
"examples": {
  "tagNewTag": "新しいタグ"
}
```

**Tag naming convention:**

- Tag ID: `new-tag` (kebab-case)
- Translation key: `examples.tagNewTag` (camelCase with prefix)
- Format: Split by "-", capitalize each word, join, prefix with `examples.tag`

### Phase 7: Generate Thumbnails

After adding files and updating metadata, generate optimized images for the UI using the thumbnail generation script.

#### What the Script Does

The script at `scripts/generate_thumbnails.py`:

1. Reads `frontend/src/features/examples/data/examples-metadata.json`
2. Downloads files from GitHub CDN URLs
3. Converts PDFs to images (first page only)
4. Generates optimized images (800x1200px, aspect ratio preserved)
5. Saves to `frontend/public/examples/images/{example_id}/`
6. Updates metadata with `imagePath` fields

#### Setup Dependencies (First Time Only)

Navigate to the skill directory and install dependencies:

```bash
cd frontend/.claude/skills/add-example
uv venv
uv pip install -e .
```

#### Run the Script

From the project root:

```bash
# Activate virtual environment
cd frontend/.claude/skills/add-example
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Run script
python scripts/generate_thumbnails.py
```

**Expected Output:**

```
============================================================
Thumbnail Generation Script
============================================================

📖 Loading metadata from: frontend/src/features/examples/data/examples-metadata.json
📁 Images will be saved to: frontend/public/examples/images

============================================================
Processing EN examples (X use cases)
============================================================

📋 Use Case Name (use_case_XXX)
------------------------------------------------------------
Processing: filename.pdf
  Downloading: https://raw.githubusercontent.com/...
  ✓ Saved: frontend/public/examples/images/use_case_XXX/file_XXX.jpg

============================================================
💾 Updating metadata file...
✓ Metadata updated: frontend/src/features/examples/data/examples-metadata.json

============================================================
✅ Thumbnail generation complete!
============================================================
Total files processed: X
Successful thumbnails: X
Failed: 0
```

#### Verify Generated Files

Check that images were created:

```bash
ls -R frontend/public/examples/images/
```

Expected structure:

```
frontend/public/examples/images/
└── use_case_XXX/
    ├── checklist_XXX.jpg
    ├── review_XXX.jpg
    └── knowledge_XXX_1.jpg (if knowledge base files exist)
```

#### Script Output Files

The script generates:

- **Single image size**: 800x1200px (used for both thumbnails and modal view)
- **Format**: JPEG with 85% quality
- **Aspect ratio**: Preserved with white letterboxing
- **Metadata update**: Adds `imagePath` field to each file

#### Troubleshooting

**Issue: "Required packages not installed"**

- **Solution**: Run `uv pip install -e .` in the skill directory

**Issue: "Metadata file not found"**

- **Solution**: Verify metadata exists at `frontend/src/features/examples/data/examples-metadata.json`

**Issue: "Failed to download"**

- **Check**: GitHub URLs are correct and accessible
- **Check**: Internet connection is working
- **Note**: URLs must use `raw.githubusercontent.com` domain

**Issue: "Failed to convert PDF"**

- **Check**: PDF file is valid and not corrupted
- **Try**: Download the PDF manually and verify it opens

**Issue: Some thumbnails succeeded, some failed**

- **Action**: Review script output for specific error messages
- **Action**: Re-run script (it will skip already-processed files)

### Phase 8: PDF Generation with reportlab (Optional)

For programmatic PDF generation using Python and reportlab.

#### Install reportlab

```bash
cd .claude/skills/add-example
uv pip install reportlab
```

#### Japanese Font Support

For Japanese PDF generation with reportlab:

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# Register Japanese font
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
```

#### Layout Implementation Examples

See `scripts/example_pdf_templates.py` for detailed implementation:

- **Two-Column Table Layout**: For checklists
- **Section Header Layout**: For evaluation documents
- **Chapter Structure Layout**: For guidelines

Includes complete implementations with headers/footers and pagination handling.

### Phase 9: Local Testing (Optional)

To verify the changes locally:

1. Start dev server:

   ```bash
   cd frontend && npm run dev
   ```

2. Navigate to: http://localhost:5173/examples

3. Verify:
   - New use case appears in the list
   - Tag filtering works correctly
   - File information displays correctly
   - Card shows correct title, description, tags
   - **Images display correctly in thumbnail grid**
   - **Modal zoom functionality works**

## File Structure Reference

### Expected Repository Structure

```
examples/
├── en/
│   └── use_case_NNN_descriptive_name/
│       ├── checklist_file.pdf
│       ├── review_file.png
│       └── knowledge_base_sources/  (optional)
│           └── reference.pdf
└── ja/
    └── ユースケースNNN_説明的な名前/
        ├── チェックリストファイル.pdf
        └── レビューファイル.pdf
```

### ID Assignment Rules

- **Use Case ID**: `use_case_{next_number}` or `use_case_{next_number}_ja`
- **File ID**: `{type}_{number}` or `{type}_{number}_ja`
- Check existing IDs in metadata JSON to find next available number

---

## Success Criteria

✅ **Files added to repository**:

- Folder created in correct language directory under `examples/`
- All files copied from contributor
- Filenames are descriptive and properly formatted

✅ **Metadata updated**:

- New entry added to correct language array in metadata JSON
- All required fields present (id, name, tags, description, files)
- File URLs constructed with proper encoding
- `hasKnowledgeBase` flag set if applicable

✅ **Translations added** (if new tags):

- Keys added to both en.json and ja.json
- Follow naming convention: `examples.tag{CamelCase}`

✅ **Thumbnails generated**:

- Script executed successfully
- All files have `imagePath` in metadata
- Images exist in `frontend/public/examples/images/{example_id}/`
- Images are 800x1200px JPEG files

✅ **Local testing** (optional but recommended):

- Dev server running without errors
- New example appears on Examples page
- Tag filtering works correctly
- File information displays correctly

✅ **Screenshot captured** (optional):

- Screenshot shows new example card
- Saved for documentation/verification

---

## Troubleshooting

### Issue: Japanese URLs return 404

**Solution**: Ensure filenames and folder names are properly URL-encoded using `encodeURIComponent()` in JavaScript

### Issue: Example not appearing

**Check**:

1. Metadata JSON syntax valid (no missing commas)
2. Language matches (`en` vs `ja`)
3. Dev server restarted after metadata changes
4. Browser cache cleared

### Issue: Download links broken

**Check**:

1. GitHub URLs use `raw.githubusercontent.com` domain
2. File paths match actual repository structure
3. Repository is public
4. Files actually exist in the repository

### Issue: Tags not displaying

**Check**:

1. Tag IDs match values defined in `ExampleTag` type (`frontend/src/features/examples/types/index.ts`)
2. Translation keys exist in i18n files
3. Tag name follows camelCase convention

### Issue: JSON syntax error

**Check**:

1. All arrays and objects have closing brackets
2. Commas between array elements (but not after last element)
3. All strings are properly quoted
4. No trailing commas

### Issue: Images not displaying in UI

**Check**:

1. `imagePath` field exists in metadata for each file
2. Image files exist at the path specified in `imagePath`
3. Path format is correct: `/examples/images/{example_id}/{file_id}.jpg`
4. Dev server restarted after adding images

### Issue: Thumbnail generation script fails

**Check**:

1. Python (latest stable version) is installed
2. Virtual environment is activated (from skill directory)
3. Dependencies installed: `uv pip install -e .`
4. Metadata file exists and is valid JSON
5. GitHub URLs in metadata are accessible

### Issue: reportlab not installed

**Solution**:

```bash
cd .claude/skills/add-example
uv pip install reportlab
```

### Issue: Japanese characters in PDF not displaying

**Check**:

1. HeiseiKakuGo-W5 font registered correctly
2. Using `UnicodeCIDFont` not `TTFont`
3. String is properly encoded (UTF-8)

**Solution**:

```python
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
c.setFont('HeiseiKakuGo-W5', 10)  # Specify size
```

---

## After Skill Completes

The skill prepares all necessary files and updates. Next steps:

1. **Review changes**: Verify all files and metadata are correct
2. **Review generated images**: Check `frontend/public/examples/images/` directory
3. **Test locally**: Verify images display correctly in the UI

---

## Files Modified

This skill modifies the following files:

- **New directory and files** in `examples/{language}/`
- **Metadata**: `frontend/src/features/examples/data/examples-metadata.json`
- **Translations** (if new tags): `frontend/src/i18n/locales/{en,ja}.json`
