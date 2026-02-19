# PDF Design Strategy

Reference for designing visually differentiated PDF files for example use cases.

## Design Principle

**Goal**: Create realistic and easy-to-understand samples

**Approach**:
- Understand the culture and conventions of the domain/industry/business
- Choose differentiation methods that feel natural in that context
- Avoid over-generalization

## Differentiation Methods

**Color Palette**: Align with domain conventions
**Layout**: Choose appropriate structure based on document type
**Headers/Footers**: Clearly indicate document information

## Reference: Pharmaceutical Regulatory Documents (UC007)

| Document | Color | Layout | Reason |
|----------|-------|--------|--------|
| Checklist | Blue | Two-column table | Clear verification items |
| Clinical Evaluation | Green | Section headers | Emphasize hierarchy |
| Guidelines | Gray | Chapter structure | Identify reference materials |

Rationale: Pharmaceutical industry's culture of formality and reliability

**Important**: This is just one example. Other domains may require completely different approaches.

## Implementation

See `scripts/example_pdf_templates.py` for three layout pattern implementations:
- Two-Column Table Layout (checklists)
- Section Header Layout (evaluation documents)
- Chapter Structure Layout (guidelines/references)

## PDF Generation with reportlab

Install reportlab:
```bash
cd .claude/skills/add-example
uv pip install reportlab
```

### Japanese Font Support

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
```

### Troubleshooting

**reportlab not installed**: Run `cd .claude/skills/add-example && uv pip install reportlab`

**Japanese characters not displaying**:
1. Verify HeiseiKakuGo-W5 font registered correctly
2. Use `UnicodeCIDFont` not `TTFont`
3. Ensure string is properly encoded (UTF-8)
