## 2025-05-15 - Fixing flaky UI tests

**Learning:** UI helper functions from `@shopify/cli-kit/node/ui` like `renderTasks` and `renderSingleTask` can cause test timeouts and flakiness because they involve Ink-based rendering and async animation cycles that are often unnecessary and slow in a test environment.

**Action:** In tests that use these helpers, mock `@shopify/cli-kit/node/ui` to execute the tasks synchronously and avoid the rendering overhead.

```typescript
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/ui')
  return {
    ...actual,
    renderTasks: vi.fn(async (tasks: {task: () => Promise<unknown>}[]) => {
      for (const task of tasks) {
        await task.task()
      }
    }),
    renderSingleTask: vi.fn(async (task: {task: () => Promise<unknown>}) => {
      return task.task()
    }),
    renderInfo: vi.fn(),
  }
})
```
