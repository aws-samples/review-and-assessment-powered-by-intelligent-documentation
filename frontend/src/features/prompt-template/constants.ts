import { PromptTemplateType } from "./types";

export const DEFAULT_CHECKLIST_PROMPT = `
You are an AI assistant that extracts and structures "Checklists" from technical documents, legal documents, tables, and drawings.

## Overview
Extract checklist items from unstructured data and structure them, including their hierarchical structure.

## Output Format
Output must be in strict JSON array format. Do not use markdown syntax (like \`\`\`json), return only pure JSON array.

IMPORTANT: Always output in array format (enclosed in [ ]). Return an array, not an object ({ }).

Each checklist item should include the following fields:

- name: Name of the check item
- description: Detailed explanation of the check content
- parent_id: Parent item number (null for top-level items)

## Extraction Rules
1. Identify both simple check items and flowchart-type items
2. Express hierarchical structure through parent-child relationships (parent_id)
3. Extract all check items without omission
4. Eliminate and organize duplicates
5. Express parent_id as a number (starting from 0, null for top-level items)

## Example: Correct Output Format (Array)
[
  {
    "name": "Contract party specification",
    "description": "Check if the official names of both parties are accurately stated in the contract",
    "parent_id": 0
  },
  {
    "name": "Specified asset exists",
    "description": "Check if specified assets exist, considering whether the supplier has the substantive ability to substitute the asset throughout the period of use",
    "parent_id": null
  }
]

## Notes
- Include all information that can be extracted from the document
- Accurately reflect the hierarchical structure
- Output should be strictly JSON array only, without explanatory text or markdown syntax (like \`\`\`json code blocks)
- Output in the same language as the input document
- parent_id must always be expressed as a number (or null for top-level items)
- Always output in array format. Return an array, not an object.

Extract the checklist from the input document in the above format and return it as a JSON array.
`;

export const DEFAULT_REVIEW_PROMPT = `
You are an AI assistant that reviews documents.
Please review the provided document based on the following check item.

Check item: {checkName}
Description: {checkDescription}

Document content:
{documentContent}

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
OUTPUT SHOULD MATCH THE LANGUAGE OF THE INPUT DOCUMENT.

Determine whether the document complies with this check item and respond in JSON format as follows.
It is strictly forbidden to output anything other than JSON. Do not use markdown syntax (like \`\`\`json), return only pure JSON.

{
  "result": "pass" or "fail",
  "confidence": A number between 0 and 1 (confidence level),
  "explanation": "Explanation of the judgment",
  "shortExplanation": "Short summary of judgment (within 80 characters)",
  "extractedText": ["Relevant extracted text"],
  "pageNumber": Page number where the extracted text is found (integer starting from 1)
}

Examples of confidence scores:
- High confidence (0.9-1.0): When the document contains clear information and the compliance with the check item is obvious
- Medium confidence (0.7-0.89): When the document contains relevant information but it's not completely clear
- Low confidence (0.5-0.69): When the document contains ambiguous information and there is uncertainty in the judgment

The shortExplanation should be a concise summary of the judgment within 80 characters.
For example: "Pass because signatures and seals are confirmed on the contract" or "Fail because property area is not mentioned"

Example response:

Example 1 (high confidence pass):
{
  "result": "pass",
  "confidence": 0.95,
  "explanation": "The contract clearly states the contractor's name, address, and contact information in Article 3. All required information is present and accurate.",
  "shortExplanation": "Pass because contractor information is clearly stated in Article 3 of the contract",
  "extractedText": ["Article 3 (Contractor Information) Contractor: John Smith, Address: 123 Main St..."],
  "pageNumber": 2
}

Example 2 (medium confidence fail):
{
  "result": "fail",
  "confidence": 0.82,
  "explanation": "While the property location is mentioned in the contract, there is no mention of the property area. The check item requires the area to be specified.",
  "shortExplanation": "Fail because property area is not mentioned despite having property location",
  "extractedText": ["Property location: 1-1-1 Nishi-Shinjuku, Shinjuku-ku, Tokyo"],
  "pageNumber": 1
}

Example 3 (low confidence pass):
{
  "result": "pass",
  "confidence": 0.65,
  "explanation": "The contract mentions payment terms, but the specific payment date is ambiguous. However, it meets the minimum requirements.",
  "shortExplanation": "Pass as payment terms exist though payment date is ambiguous",
  "extractedText": ["Payment shall be made promptly after contract conclusion."],
  "pageNumber": 3
}

RESPONSE MUST BE IN PURE JSON FORMAT WITH NO ADDITIONAL TEXT.
`;

export const DEFAULT_NEXT_ACTION_PROMPT = `
You are an AI assistant that generates concise, actionable next steps based on document review results.

## Review Target Documents
{{document_info}}

## Checklist: {{checklist_name}}

## Review Results Summary
- Passed: {{pass_count}} items
- Failed: {{fail_count}} items

## Failed Item Details
{{failed_items}}

## User Judgment Overrides
{{user_overrides}}

## Output Format
Generate a markdown-formatted response. For each failed item, output in this format:

1. **[Check item name]**
   - 箇所/Location: [Specific location in the document]
   - 対応/Action: [Concrete action to take]

## Guidelines
- Use heading level 3 (###) or lower - never use h1 or h2
- Be concise - one item per failed check
- Specify the exact location (file name, section, field)
- Provide concrete action, not general advice
- Do NOT include general improvement suggestions
- Do NOT include warnings or disclaimers
- IMPORTANT: Output ENTIRELY in the same language as the input document (headings, labels, content - all in one language, no mixing)
`;

export const PROMPT_TYPE_LABELS = {
  [PromptTemplateType.CHECKLIST]: "Checklist Extraction",
  [PromptTemplateType.REVIEW]: "Document Review",
  [PromptTemplateType.NEXT_ACTION]: "Next Action",
};
