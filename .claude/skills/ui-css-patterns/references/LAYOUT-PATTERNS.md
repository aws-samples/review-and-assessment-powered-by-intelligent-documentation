# Common Layout Patterns

Reference implementations for common RAPID frontend layouts.

## Page Layout

```tsx
<div className="container mx-auto px-4 py-8 max-w-7xl">
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark mb-2">
      {t("page.title")}
    </h1>
    <p className="text-aws-font-color-gray">{t("page.description")}</p>
  </div>
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
    <p className="mt-2 text-aws-font-color-gray">{t("page.description")}</p>
  </div>
  <Button variant="primary">{t("action.create")}</Button>
</div>
```

## Responsive Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item) => <Card key={item.id} item={item} />)}
</div>
```

## Form Layout

```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  <FormTextField label={t("form.name")} value={name} onChange={setName} error={errors.name} required />
  <FormTextArea label={t("form.description")} value={description} onChange={setDescription} rows={4} />
  <div className="flex justify-end gap-3">
    <Button variant="primary" outline onClick={onCancel}>{t("common.cancel")}</Button>
    <Button variant="primary" type="submit" disabled={isSubmitting}>{t("common.save")}</Button>
  </div>
</form>
```

## State Handling (Loading, Error, Empty, Success)

```tsx
{isLoading ? (
  <Skeleton count={5} height={80} />
) : error ? (
  <ErrorAlert error={error} title={t("error.loadFailed")} />
) : items.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-aws-font-color-gray text-lg mb-4">{t("list.emptyState")}</p>
    <Button variant="primary" onClick={handleCreate}>{t("action.createFirst")}</Button>
  </div>
) : (
  <div className="grid grid-cols-1 gap-6">
    {items.map(item => <ItemCard key={item.id} item={item} />)}
  </div>
)}
```

## Modal Workflow

```tsx
const [isOpen, setIsOpen] = useState(false);

<>
  <Button variant="primary" onClick={() => setIsOpen(true)}>{t("action.open")}</Button>
  <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("modal.title")}>
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="primary" outline onClick={() => setIsOpen(false)}>{t("common.cancel")}</Button>
        <Button variant="primary" type="submit">{t("common.save")}</Button>
      </div>
    </form>
  </Modal>
</>
```

## Toast Notifications

```tsx
import { useToast } from '@/contexts/ToastContext';

const { addToast } = useToast();

try {
  await createChecklistSet({ name, description });
  addToast(t("success.message"), "success");
} catch (error) {
  addToast(t("error.message"), "error");
}
```
