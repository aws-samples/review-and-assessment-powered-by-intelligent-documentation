---
name: ui-css-patterns
description: UI/CSS design patterns reference for RAPID frontend - color semantics, component selection, common layouts
---

# Frontend UI/CSS Design Patterns

Quick reference for maintaining visual consistency across the RAPID frontend.
Use this when implementing UI components or choosing styling approaches.

**Related Skills**:
- For backend/frontend planning → use `/plan-backend-frontend`
- For agent prompts → use `/modify-agent-prompts`

## Core Design Principles

### Action Hierarchy & Color Semantics

**Decision Matrix** (based on 200+ actual usage instances):

| **Action Type** | **Button Variant** | **Outline** | **When to Use** | **Examples** |
|-----------------|-------------------|-------------|-----------------|--------------|
| **Submit/Create** | `primary` | `false` | Main form submission, creating resources | "Create", "Save", "Compare" |
| **Cancel/Back** | `primary` | **`true`** | Dismissing modals, going back | "Cancel", "Back" |
| **Delete/Remove** | `danger` | `false` (strong)<br/>`true` (soft) | Destructive actions | "Delete Checklist" (filled)<br/>Inline delete (outline) |
| **Alternative** | `secondary` | `false` | Non-primary actions that aren't cancel | "Duplicate", "Retry" |
| **UI Toggle** | `text` | n/a | Show/hide, expand/collapse | "Show More", "Expand Tree" |
| **Inline Action** | `text` + `size="sm"` | n/a | Actions within tree/list items | Edit/Delete in tree nodes |
| **Table Action** | varies | **`true`** | Actions in data tables | "View", "Download" |

**Key Pattern**: Outlined primary = cancel/dismiss, Filled primary = submit/create

**Color Mappings**:
- **Primary actions**: `aws-sea-blue-light` / `aws-sea-blue-dark`
- **Secondary actions**: `aws-aqua`
- **Success states**: `aws-lab` (brand green), `green-500` (icons), `green-100/800` (badges)
- **Danger/Error**: `red` (buttons), `red-500` (icons), `red-100/800` (badges)
- **Warning**: `yellow-400` (borders), `yellow-100/800` (badges)
- **Info/Neutral**: `aws-font-color-blue` (links), `blue-100/800` (badges)

### How to Determine Color Semantics

**5-Step Decision Process**:

1. **Identify Action Context**
   - Completing a task → Primary
   - Abandoning a task → Cancel (outlined primary)
   - Destroying data → Danger
   - Viewing information → Secondary or text
   - Toggling UI state → Text

2. **Assess Visual Hierarchy**
   - One main action + others → Main = filled primary, others = outlined or secondary
   - Multiple equal actions → All outlined or secondary
   - Inline/subtle actions → Text variant + small size

3. **Consider Consequences**
   - Irreversible destruction → Danger (red)
   - Data mutation → Primary (blue)
   - Reversible action → Secondary (aqua) or text
   - No side effects → Text

4. **Follow the Pattern** - Check similar features:
   ```bash
   grep -r "variant=" frontend/src/features/{similar-feature}/
   ```

   Observed patterns:
   - Form submissions: 100% filled primary (11/11)
   - Modal cancels: 100% outlined primary (16/16)
   - Delete operations: Consistent danger variant
   - Inline tree actions: 100% text + small

5. **Validate with Questions**
   - "Is this the ONE thing users came here to do?" → Filled primary
   - "Could user want to cancel?" → Add outlined cancel button
   - "Will this delete user data?" → Use danger variant
   - "Is this a secondary workflow?" → Use secondary or outlined
   - "Is this just UI manipulation?" → Use text variant

**Anti-Patterns**:
- ❌ Multiple filled primary buttons in same view
- ❌ Filled danger for reversible actions
- ❌ Primary for cancel/dismiss
- ❌ Text variant for important mutations

### Status & Feedback Colors

**For Operation Feedback (Toasts, Alerts)**:
- **Success** → Green: `addToast(message, "success")`
- **Error** → Red: `addToast(message, "error")` or `<ErrorAlert>`
- **Warning** → Yellow: `<InfoAlert variant="warning">`
- **Info** → Blue: `<InfoAlert variant="info">`

**For Status Badges**:
| State | Color | When to Use |
|-------|-------|-------------|
| `PENDING` | Yellow | Task queued, waiting to start |
| `PROCESSING` | Blue | Task currently running |
| `DETECTING` | Purple | AI-specific subprocess |
| `COMPLETED` | Green | Task finished successfully |
| `FAILED` | Red | Task encountered error |

**For Review Result Badges**:
| Result | Color | Meaning |
|--------|-------|---------|
| `UNDER_REVIEW` | Blue | AI flagged for human review |
| `PASS` | Green | Item approved/compliant |
| `NOT_PASS` | Red | Item rejected/non-compliant |
| `LOW_CONFIDENCE` | Yellow | AI uncertain, needs verification |
| `USER_OVERRIDE` | AWS Blue | Human decision overrode AI |

### Spacing & Layout

**Spacing System** (8px base unit):
- Common values: `gap-2`, `gap-4`, `gap-6`, `p-4`, `p-6`, `mb-8`
- Page containers: `max-w-7xl mx-auto px-4 py-8`
- Form spacing: `space-y-6`

**Typography Hierarchy**:
- Page titles: `text-3xl font-bold`
- Section headings: `text-xl` or `text-2xl`
- Body text: `text-sm` or `text-base`
- Metadata: `text-xs text-aws-font-color-gray`

**Dark Mode Strategy**:
- Always pair backgrounds: `bg-white dark:bg-aws-squid-ink-dark`
- Always pair text: `text-aws-font-color-light dark:text-aws-font-color-dark`
- Consistent hover states: `hover:bg-aws-paper-light dark:hover:bg-aws-ui-color-dark`

### Component Placement Principles

#### Logical Grouping - Actions Near Their Context

**Rule**: Action buttons should be placed NEAR what they affect, not right-aligned from unrelated labels.

**Vertical Layout Pattern**:
```tsx
<div>
  {/* Label */}
  <span className="text-sm font-medium mb-3 block">
    {t("filter.label")}
  </span>

  {/* Content being acted upon */}
  <div className="flex flex-wrap gap-2">
    {items}
  </div>

  {/* Action - logically grouped below content */}
  <div className="mt-3">
    <Button variant="text" size="sm" onClick={handleClear}>
      {t("filter.clear")}
    </Button>
  </div>
</div>
```

**Anti-Pattern** - `justify-between` with conditional action:
```tsx
// ❌ BAD - action appears far from content it affects
<div className="flex items-center justify-between mb-3">
  <span>{t("filter.label")}</span>
  {hasSelection && (
    <Button onClick={handleClear}>Clear</Button>  /* Far from filtered content */
  )}
</div>
<div className="flex gap-2">
  {items}
</div>
```

**Why It Matters**:
- Users look for actions near the content they affect
- Right-aligned buttons that appear suddenly are disorienting
- Vertical flow is more predictable: Label → Content → Action
- Especially important for actions that appear conditionally

**Real-World Fix**: TagFilter Clear button moved below tags instead of right-aligned next to label.

### Component Composition

- Check `src/components/` before creating new components
- Use existing components as building blocks
- Never use native `<button>` - always use `Button` component
- Never use native `alert()` or `confirm()` - use `useAlert` hook
- Always use `react-icons` - SVG usage prohibited
- Always pair color with icon/text for accessibility

### Interactive Element Patterns

#### Visual Affordance - "Make it Obviously Clickable"

**Critical Rule**: `cursor-pointer` alone is NOT enough. Elements must LOOK interactive BEFORE hovering.

**Pattern**: Use visible borders, distinct backgrounds, or shadows in default state.

**Tag/Pill/Chip Pattern**:
```tsx
<button className="
  cursor-pointer border-2 transition-all
  border-light-gray dark:border-aws-ui-color-dark
  hover:border-aws-sea-blue-light dark:hover:border-aws-sea-blue-dark
  bg-aws-paper-light dark:bg-aws-paper-dark
  hover:bg-light-gray dark:hover:bg-aws-squid-ink-dark
">
  Interactive Tag
</button>
```

**Key Indicators of Clickability**:
1. `cursor-pointer` - Changes cursor on hover
2. `border-2` with visible color - Shows it's an element you can interact with
3. `transition-all` - Smooth feedback on interaction
4. Hover state changes - Border and background color shift

**Anti-Pattern**:
- ❌ Using only `cursor-pointer` + subtle hover background change
- ❌ Making elements look like static labels/badges
- ❌ Relying on hover alone to indicate interactivity

**Real-World Fix**: TagFilter tags were not obviously clickable. Added `border-2` with visible borders in default state, not just on hover.

#### Smooth Transitions for Conditional UI

**Pattern**: Always render, control with opacity + height transitions.

```tsx
<div className={`transition-all duration-300 ${
  isVisible
    ? 'opacity-100 max-h-10'
    : 'opacity-0 max-h-0 pointer-events-none'
}`}>
  <Component />
</div>
```

**When to Use**: Conditionally shown buttons, dropdown menus, expandable sections.

**Why**: No layout shift, smooth 300ms fade (matches Sidebar).

## Component Quick Reference

Discover available components:
```bash
ls -la frontend/src/components/
```

| Use Case | Component | Key Props | Location |
|----------|-----------|-----------|----------|
| Primary/secondary actions | `Button` | `variant` `outline` `size` | `/components/Button.tsx` |
| Form text input | `FormTextField` | `label` `error` `required` | `/components/FormTextField.tsx` |
| Form textarea | `FormTextArea` | `label` `error` `rows` | `/components/FormTextArea.tsx` |
| File upload | `FormFileUpload` | `onFilesSelected` `accept` | `/components/FormFileUpload.tsx` |
| Modals/dialogs | `Modal` | `isOpen` `onClose` `title` | `/components/Modal.tsx` |
| Alert confirmations | `useAlert` hook | `showAlert` `showConfirm` `AlertModal` | `/hooks/useAlert.ts` |
| Page layout | `Layout` | `children` | `/components/Layout.tsx` |
| Navigation sidebar | `Sidebar` | | `/components/Sidebar.tsx` |
| Page header | `PageHeader` | `title` `description` `actions` | `/components/PageHeader.tsx` |
| Data tables | `Table` | `columns` `data` `loading` | `/components/Table.tsx` |
| Status badges | `StatusBadge` | `status` | `/components/StatusBadge.tsx` |
| Result cards | `ResultCard` | `title` `content` `variant` | `/components/ResultCard.tsx` |
| Loading skeleton | `Skeleton` | `count` `height` | `/components/Skeleton.tsx` |
| Pagination | `Pagination` | `currentPage` `totalPages` `onPageChange` | `/components/Pagination.tsx` |
| Error display | `ErrorAlert` | `error` `title` | `/components/ErrorAlert.tsx` |
| Info display | `InfoAlert` | `message` `variant` | `/components/InfoAlert.tsx` |
| Breadcrumbs | `Breadcrumb` | `items` | `/components/Breadcrumb.tsx` |
| Segmented control | `SegmentedControl` | `options` `value` `onChange` | `/components/SegmentedControl.tsx` |
| Tooltips | `Tooltip` | `content` `position` | `/components/Tooltip.tsx` |

**Pattern**: When a new component is added, add one row to this table.

## Common Implementation Patterns

### Page Layout

```tsx
<div className="container mx-auto px-4 py-8 max-w-7xl">
  {/* Page header */}
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark mb-2">
      {t("page.title")}
    </h1>
    <p className="text-aws-font-color-gray">
      {t("page.description")}
    </p>
  </div>

  {/* Page content */}
  {content}
</div>
```

**With action button**:
```tsx
<div className="mb-6 flex items-center justify-between">
  <div>
    <div className="flex items-center">
      <Icon className="mr-2 h-8 w-8 text-aws-font-color-light dark:text-aws-font-color-dark" />
      <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark">
        {t("page.title")}
      </h1>
    </div>
    <p className="mt-2 text-aws-font-color-gray">
      {t("page.description")}
    </p>
  </div>
  <Button variant="primary">{t("action.create")}</Button>
</div>
```

### Responsive Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item) => (
    <Card key={item.id} item={item} />
  ))}
</div>
```

### Form Layout

```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  <FormTextField
    label={t("form.name")}
    value={name}
    onChange={setName}
    error={errors.name}
    required
  />

  <FormTextArea
    label={t("form.description")}
    value={description}
    onChange={setDescription}
    rows={4}
  />

  <div className="flex justify-end gap-3">
    <Button variant="primary" outline onClick={onCancel}>
      {t("common.cancel")}
    </Button>
    <Button variant="primary" type="submit" disabled={isSubmitting}>
      {t("common.save")}
    </Button>
  </div>
</form>
```

### State Handling (Loading, Error, Empty, Success)

```tsx
{isLoading ? (
  <Skeleton count={5} height={80} />
) : error ? (
  <ErrorAlert error={error} title={t("error.loadFailed")} />
) : items.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-aws-font-color-gray text-lg mb-4">
      {t("list.emptyState")}
    </p>
    <Button variant="primary" onClick={handleCreate}>
      {t("action.createFirst")}
    </Button>
  </div>
) : (
  <div className="grid grid-cols-1 gap-6">
    {items.map(item => <ItemCard key={item.id} item={item} />)}
  </div>
)}
```

### Modal Workflow

```tsx
const [isOpen, setIsOpen] = useState(false);

// In render
<>
  <Button variant="primary" onClick={() => setIsOpen(true)}>
    {t("action.open")}
  </Button>

  <Modal
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    title={t("modal.title")}
  >
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="primary" outline onClick={() => setIsOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" type="submit">
          {t("common.save")}
        </Button>
      </div>
    </form>
  </Modal>
</>
```

### Toast Notifications

```tsx
import { useToast } from '@/contexts/ToastContext';

const { addToast } = useToast();

// Success
addToast(t("checklist.createSuccess"), "success");

// Error
addToast(t("checklist.createError"), "error");

// With try/catch
try {
  await createChecklistSet({ name, description });
  addToast(t("success.message"), "success");
} catch (error) {
  addToast(t("error.message"), "error");
}
```
