export function batchedRequests<TItem>(
  items: TItem[],
  batchSize: number,
  fn: (batch: TItem[]) => Promise<unknown>,
): Promise<unknown>[] {
  const requests = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    requests.push(fn(batch))
  }
  return requests
}

export interface Task {
  title: string
  task: () => Promise<void>
}

/** Waits for every operation to stop before propagating a failure. */
export async function waitForAll(promises: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(promises)
  const failure = results.find((result) => result.status === 'rejected')
  if (failure) throw failure.reason
}

export function batchedTasks<TItem>(
  items: TItem[],
  batchSize: number,
  fn: (batch: TItem[], start: number) => Task,
): Task[] {
  const tasks: Task[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    tasks.push(fn(batch, i))
  }

  return tasks
}
