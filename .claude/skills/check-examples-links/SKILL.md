# Check Examples GitHub Links

Verify all GitHub raw content URLs in examples metadata are accessible.

## Objective

Test every GitHub URL in `frontend/src/features/examples/data/examples-metadata.json` to ensure:
1. All URLs return HTTP 200 (OK)
2. Content is accessible
3. No broken or missing files on GitHub

## Process

1. **Read metadata** - Parse `frontend/src/features/examples/data/examples-metadata.json`

2. **Extract URLs** - Get all `url` fields from both English and Japanese examples:
   ```json
   {
     "en": [{ "files": [{ "url": "https://raw.githubusercontent.com/..." }] }],
     "ja": [{ "files": [{ "url": "https://raw.githubusercontent.com/..." }] }]
   }
   ```

3. **Test each URL** - Use WebFetch or HTTP HEAD/GET requests:
   - Set 10-second timeout
   - Check for HTTP 200 response
   - Record success/failure

4. **Generate report**:
   ```
   🔍 Testing GitHub URLs for examples...

   ✅ EN use_case_001 checklist: OK (200)
   ✅ EN use_case_001 review: OK (200)
   ❌ EN use_case_004 review: FAILED (404)
   ...

   📊 SUMMARY
   ==============================
   Total URLs: 25
   ✅ Working: 24
   ❌ Broken: 1

   ❌ BROKEN URLS:
   - https://raw.githubusercontent.com/.../review_004.pdf
     Status: 404 Not Found
   ```

## Implementation Strategy

- Parse JSON metadata to extract all URL fields
- For each URL:
  - Use WebFetch tool with simple prompt: "Check if this URL is accessible"
  - Or use Python urllib with 10s timeout
  - Record HTTP status code
- Summarize results with counts and failed URL list

## Success Criteria

- All URLs return HTTP 200
- No timeout errors
- Content-Type headers appropriate for file types (PDF/PNG/TXT)
