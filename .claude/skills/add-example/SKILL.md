---
name: add-example
description: Add new example use cases to the Examples feature, including file setup, metadata registration, thumbnail generation, and link verification. Use when a contributor provides PDF/PNG/TXT files for a new use case, when adding entries to the Examples page, or when verifying existing example GitHub URLs are accessible.
---

# Add Example Use Case

Guide for adding new use cases to the Examples feature when contributors provide sample files.

## Prerequisites

- Use case files from contributor (PDF, PNG, TXT, etc.)
- Use case metadata: name, description, category
- Python with uv package manager installed

---

## Step-by-Step Process

### Phase 1: Gather Information

Ask the user for:

- **Use case name** (English or Japanese)
- **Use case description**
- **Category tags**: See `ExampleTag` type in `frontend/src/features/examples/types/index.ts`
- **Language**: `en` or `ja`
- **Files provided** with types: `checklist`, `review`, `knowledge`
- **Location** of files provided by contributor

### Phase 2: Prepare Files in Repository

1. Read `frontend/src/features/examples/data/examples-metadata.json`
2. Determine next available use case number:
   - Check existing IDs in the appropriate language array
   - Use `use_case_NNN` for English or `use_case_NNN_ja` for Japanese
3. Create directory: `examples/{language}/use_case_NNN_descriptive_name/`
4. Copy contributor files, organize by type, use descriptive filenames

### Phase 3: PDF Design (Optional)

If the use case includes multiple PDF files requiring visual differentiation:

**Read [references/PDF-DESIGN.md](references/PDF-DESIGN.md)** for design strategy, layout patterns, and reportlab generation instructions.

### Phase 4: Generate GitHub URLs

For each file, construct the raw GitHub URL:

```
https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/examples/{lang}/{folder}/{file}
```

**Important**: Japanese characters MUST be URL-encoded using `encodeURIComponent()`.

### Phase 5: Update Metadata

Edit `frontend/src/features/examples/data/examples-metadata.json`:

```json
{
  "id": "use_case_NNN",
  "name": "Use Case Display Name",
  "tags": ["tag1", "tag2"],
  "description": "What this use case demonstrates",
  "hasKnowledgeBase": true,
  "files": [
    {
      "id": "checklist_NNN",
      "name": "checklist_file.pdf",
      "type": "checklist",
      "url": "https://raw.githubusercontent.com/.../checklist_file.pdf"
    }
  ]
}
```

- Set `hasKnowledgeBase: true` only if knowledge files are included
- Ensure JSON syntax is valid

### Phase 6: Add New Category Tags (if needed)

**Only if introducing NEW tags** - requires updating three locations:

#### 1. TypeScript Type Definition

Edit `frontend/src/features/examples/types/index.ts` - add new tag to `ExampleTag` union type.

#### 2. UI Components

Add tag with emoji icon to both:
- `frontend/src/features/examples/components/TagFilter.tsx` (`tags` array)
- `frontend/src/features/examples/components/OnboardingModal.tsx` (`industries` array)

Use the same emoji in both components.

#### 3. Translations

Add to both `frontend/src/i18n/locales/en.json` and `ja.json`:
```json
"examples": {
  "tagNewTag": "Display Name"
}
```

**Tag naming convention**: Tag ID: `new-tag` (kebab-case) -> Translation key: `examples.tagNewTag` (camelCase with prefix)

### Phase 7: Generate Thumbnails

Run the thumbnail generation script:

```bash
# First time only: install dependencies
cd .claude/skills/add-example && uv venv && uv pip install -e .

# Run script (from project root)
cd .claude/skills/add-example && source .venv/bin/activate
python scripts/generate_thumbnails.py
```

The script:
1. Reads examples-metadata.json
2. Downloads files from GitHub CDN URLs
3. Converts PDFs to images (first page only)
4. Generates 800x1200px JPEG images (85% quality)
5. Saves to `frontend/public/examples/images/{example_id}/`
6. Updates metadata with `imagePath` fields

### Phase 8: Verify GitHub URLs

Test every GitHub URL in the metadata to ensure accessibility:

1. Parse `frontend/src/features/examples/data/examples-metadata.json`
2. Extract all `url` fields from both `en` and `ja` arrays
3. Test each URL (WebFetch or HTTP GET with 10s timeout)
4. Report results:
   - Total URLs tested
   - Working (HTTP 200) vs broken
   - List of broken URLs with status codes

All URLs must return HTTP 200 for the example to be complete.

### Phase 9: Local Testing (Optional)

```bash
cd frontend && npm run dev
```

Navigate to http://localhost:5173/examples and verify:
- New use case appears in the list
- Tag filtering works correctly
- Images display in thumbnail grid and modal zoom

## File Structure Reference

```
examples/
├── en/use_case_NNN_descriptive_name/
│   ├── checklist_file.pdf
│   ├── review_file.png
│   └── knowledge_base_sources/ (optional)
└── ja/ユースケースNNN_説明的な名前/
    └── ファイル.pdf
```

### ID Assignment Rules

- **Use Case ID**: `use_case_{next_number}` or `use_case_{next_number}_ja`
- **File ID**: `{type}_{number}` or `{type}_{number}_ja`

---

## Success Criteria

- Files added to correct language directory under `examples/`
- Metadata entry added with all required fields (id, name, tags, description, files)
- File URLs properly encoded
- Thumbnails generated with `imagePath` in metadata
- All GitHub URLs return HTTP 200
- Translations added (if new tags)

## Troubleshooting

### Japanese URLs return 404
Ensure filenames are URL-encoded using `encodeURIComponent()`.

### Example not appearing
1. Verify metadata JSON syntax (no missing commas)
2. Confirm language matches (`en` vs `ja`)
3. Restart dev server and clear browser cache

### Images not displaying
1. Verify `imagePath` field exists in metadata
2. Confirm image files exist at the specified path
3. Path format: `/examples/images/{example_id}/{file_id}.jpg`

### Thumbnail script fails
1. Verify virtual environment activated from skill directory
2. Install dependencies: `cd .claude/skills/add-example && uv pip install -e .`
3. Confirm metadata file exists and GitHub URLs are accessible
