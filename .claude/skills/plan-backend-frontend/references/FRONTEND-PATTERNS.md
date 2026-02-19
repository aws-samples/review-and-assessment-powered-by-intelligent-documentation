# Frontend Architecture Patterns

Reference implementations for the RAPID frontend feature-based architecture.

## Feature Structure

```
frontend/src/features/{feature-name}/
├── hooks/
│   ├── use{Feature}Queries.ts    # GET operations with SWR
│   └── use{Feature}Mutations.ts  # POST/PUT/PATCH/DELETE operations
├── components/
│   └── {Component}.tsx            # Feature-specific components
└── types/
    └── index.ts                   # Feature-specific types
```

## API Query Hook (SWR)

```typescript
import useSWR from 'swr';
import { useApiClient } from '@/hooks/useApiClient';

export const useChecklistSets = () => {
  const { get } = useApiClient();
  return useSWR('/checklist-sets', async () => {
    const response = await get('/checklist-sets');
    return response.data;
  });
};

export const useChecklistSet = (id: string) => {
  const { get } = useApiClient();
  return useSWR(id ? `/checklist-sets/${id}` : null, async () => {
    const response = await get(`/checklist-sets/${id}`);
    return response.data;
  });
};
```

## API Mutation Hook

```typescript
import { useApiClient } from '@/hooks/useApiClient';
import { mutate } from 'swr';

export const useChecklistMutations = () => {
  const { post, put, del } = useApiClient();

  const createChecklistSet = async (data: CreateChecklistSetRequest) => {
    const response = await post('/checklist-sets', data);
    mutate('/checklist-sets');
    return response.data;
  };

  const deleteChecklistSet = async (id: string) => {
    await del(`/checklist-sets/${id}`);
    mutate('/checklist-sets');
  };

  return { createChecklistSet, deleteChecklistSet };
};
```
