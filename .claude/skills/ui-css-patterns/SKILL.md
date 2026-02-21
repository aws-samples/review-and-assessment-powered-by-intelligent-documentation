---
name: ui-css-patterns
description: UI/CSS design patterns and component reference for the RAPID frontend, covering color semantics, button variant selection, status badge colors, dark mode, spacing, and component inventory. Use when implementing UI components, choosing button variants or colors, styling with Tailwind CSS, or checking available shared components.
---

# Frontend UI/CSS Design Patterns

Quick reference for maintaining visual consistency across the RAPID frontend.

## Action Hierarchy & Color Semantics

| **Action Type** | **Button Variant** | **Outline** | **Examples** |
|-----------------|-------------------|-------------|--------------|
| **Submit/Create** | `primary` | `false` | "Create", "Save", "Compare" |
| **Cancel/Back** | `primary` | **`true`** | "Cancel", "Back" |
| **Delete/Remove** | `danger` | `false` (strong) / `true` (soft) | "Delete Checklist" / inline delete |
| **Alternative** | `secondary` | `false` | "Duplicate", "Retry" |
| **UI Toggle** | `text` | n/a | "Show More", "Expand Tree" |
| **Inline Action** | `text` + `size="sm"` | n/a | Edit/Delete in tree nodes |
| **Table Action** | varies | **`true`** | "View", "Download" |

**Key Pattern**: Outlined primary = cancel/dismiss. Filled primary = submit/create.

**Color Mappings**:
- Primary: `aws-sea-blue-light` / `aws-sea-blue-dark`
- Secondary: `aws-aqua`
- Success: `aws-lab` (brand green), `green-500` (icons), `green-100/800` (badges)
- Danger: `red` (buttons), `red-500` (icons), `red-100/800` (badges)
- Warning: `yellow-400` (borders), `yellow-100/800` (badges)
- Info: `aws-font-color-blue` (links), `blue-100/800` (badges)

### 5-Step Color Decision Process

1. **Identify Action Context**: Completing -> Primary, Abandoning -> Cancel (outlined), Destroying -> Danger
2. **Assess Visual Hierarchy**: One main action = filled primary, others = outlined/secondary
3. **Consider Consequences**: Irreversible -> Danger, Mutation -> Primary, Reversible -> Secondary
4. **Follow Existing Patterns**: `grep -r "variant=" frontend/src/features/{similar-feature}/`
5. **Validate**: "Is this the ONE thing users came here to do?" -> Filled primary

**Anti-Patterns**:
- Multiple filled primary buttons in same view
- Filled danger for reversible actions
- Primary for cancel/dismiss

### Status & Feedback Colors

**Toasts**: Success -> `"success"`, Error -> `"error"`

**Status Badges**: PENDING=Yellow, PROCESSING=Blue, DETECTING=Purple, COMPLETED=Green, FAILED=Red

**Review Results**: UNDER_REVIEW=Blue, PASS=Green, NOT_PASS=Red, LOW_CONFIDENCE=Yellow, USER_OVERRIDE=AWS Blue

### Spacing & Typography

- Spacing: 8px base (`gap-2`, `gap-4`, `p-4`, `p-6`)
- Page containers: `max-w-7xl mx-auto px-4 py-8`
- Titles: `text-3xl font-bold`, Sections: `text-xl`/`text-2xl`, Body: `text-sm`/`text-base`
- Dark mode pairs: `bg-white dark:bg-aws-squid-ink-dark`, `text-aws-font-color-light dark:text-aws-font-color-dark`

## Component Placement Principles

### Logical Grouping

**Rule**: Actions near their context, not right-aligned from unrelated labels.

```tsx
{/* Vertical: Label -> Content -> Action */}
<div>
  <span className="text-sm font-medium mb-3 block">{t("filter.label")}</span>
  <div className="flex flex-wrap gap-2">{items}</div>
  <div className="mt-3">
    <Button variant="text" size="sm" onClick={handleClear}>{t("filter.clear")}</Button>
  </div>
</div>
```

### Interactive Element Affordance

**Critical**: `cursor-pointer` alone is NOT enough. Elements must LOOK interactive before hovering.

```tsx
<button className="
  cursor-pointer border-2 transition-all
  border-light-gray dark:border-aws-ui-color-dark
  hover:border-aws-sea-blue-light dark:hover:border-aws-sea-blue-dark
  bg-aws-paper-light dark:bg-aws-paper-dark
">
  Interactive Tag
</button>
```

### Smooth Transitions for Conditional UI

```tsx
<div className={`transition-all duration-300 ${
  isVisible ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0 pointer-events-none'
}`}>
```

## Component Rules

- Check `src/components/` before creating new components
- Never use native `<button>` -> use `Button` component
- Never use native `alert()`/`confirm()` -> use `useAlert` hook
- Always use `react-icons` (SVG prohibited)
- Always pair color with icon/text for accessibility

## Component Quick Reference

| Use Case | Component | Key Props |
|----------|-----------|-----------|
| Actions | `Button` | `variant` `outline` `size` |
| Text input | `FormTextField` | `label` `error` `required` |
| Textarea | `FormTextArea` | `label` `rows` |
| File upload | `FormFileUpload` | `onFilesSelected` `accept` |
| Modals | `Modal` | `isOpen` `onClose` `title` |
| Confirmations | `useAlert` hook | `showAlert` `showConfirm` |
| Page header | `PageHeader` | `title` `description` `actions` |
| Data tables | `Table` | `columns` `data` `loading` |
| Status badges | `StatusBadge` | `status` |
| Loading | `Skeleton` | `count` `height` |
| Pagination | `Pagination` | `currentPage` `totalPages` |
| Errors | `ErrorAlert` | `error` `title` |
| Info | `InfoAlert` | `message` `variant` |
| Breadcrumbs | `Breadcrumb` | `items` |
| Segmented control | `SegmentedControl` | `options` `value` `onChange` |
| Tooltips | `Tooltip` | `content` `position` |

For common layout implementations (page layout, grids, forms, modals, toasts), see [references/LAYOUT-PATTERNS.md](references/LAYOUT-PATTERNS.md).
