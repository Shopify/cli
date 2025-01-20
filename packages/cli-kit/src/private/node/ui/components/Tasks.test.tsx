import {Task, Tasks} from './Tasks.js'
import {getLastFrameAfterUnmount, render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {AbortController} from '../../../../public/node/abort.js'
import {Stdout} from '../../ui.js'
import React from 'react'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {useStdout} from 'ink'

vi.mock('ink', async () => {
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(useStdout).mockReturnValue({
    stdout: new Stdout({
      columns: 80,
      rows: 80,
    }) as any,
    write: () => {},
  })
})

describe('Tasks', () => {
  test('shows a loading state at the start', async () => {
    // Given
    const firstTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} />)
    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      task 1 ..."
    `)
    expect(firstTaskFunction).toHaveBeenCalled()
  })

  test('shows a loading state that is useful in no-color mode', async () => {
    // Given
    const firstTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} noColor />)

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁
      task 1 ..."
    `)
    expect(firstTaskFunction).toHaveBeenCalled()
  })

  test('shrinks the no-color display for narrow screens', async () => {
    // Given
    vi.mocked(useStdout).mockReturnValue({
      stdout: new Stdout({
        columns: 10,
        rows: 80,
      }) as any,
      write: () => {},
    })

    const firstTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} noColor />)

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▂▃▄▅▆▇█▇▆▅▄▃▂▁▁
      task 1 ..."
    `)
    expect(firstTaskFunction).toHaveBeenCalled()
  })

  test('shows nothing at the end in case of success', async () => {
    // Given
    const firstTaskFunction = vi.fn(async () => {})
    const secondTaskFunction = vi.fn(async () => {})

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    const secondTask = {
      title: 'task 2',
      task: secondTaskFunction,
    }
    // When

    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} silent={false} />)
    await renderInstance.waitUntilExit()

    // Then
    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot('""')
  })

  test('stops at the task that throws error', async () => {
    // Given
    const abortController = new AbortController()
    const secondTaskFunction = vi.fn(async () => {})

    const firstTask: Task = {
      title: 'task 1',
      task: async () => {
        throw new Error('something went wrong')
      },
    }

    const secondTask = {
      title: 'task 2',
      task: secondTaskFunction,
    }

    // When
    const renderInstance = render(
      <Tasks tasks={[firstTask, secondTask]} silent={false} abortSignal={abortController.signal} />,
    )

    // Then
    await expect(renderInstance.waitUntilExit()).rejects.toThrowError('something went wrong')
    expect(secondTaskFunction).toHaveBeenCalledTimes(0)
  })

  test('it supports subtasks', async () => {
    // Given
    const firstSubtaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: async () => {
        return [
          {
            title: 'subtask 1',
            task: firstSubtaskFunction,
          },
          {
            title: 'subtask 2',
            task: async () => {},
          },
        ]
      },
    }

    const secondTask = {
      title: 'task 2',
      task: async () => {},
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      subtask 1 ..."
    `)

    expect(firstSubtaskFunction).toHaveBeenCalled()
  })

  test('supports skipping', async () => {
    // Given
    const firstTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
      skip: () => true,
    }

    const secondTask = {
      title: 'task 2',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      task 2 ..."
    `)
    expect(firstTaskFunction).toHaveBeenCalledTimes(0)
  })

  test('supports skipping a subtask', async () => {
    // Given
    const firstSubTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const secondSubTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask = {
      title: 'task 1',
      task: async () => {
        return [
          {
            title: 'subtask 1',
            task: firstSubTaskFunction,
            skip: () => true,
          },
          {
            title: 'subtask 2',
            task: secondSubTaskFunction,
          },
        ]
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      subtask 2 ..."
    `)

    expect(firstSubTaskFunction).toHaveBeenCalledTimes(0)
    expect(secondSubTaskFunction).toHaveBeenCalled()
  })

  test('supports retrying', async () => {
    // Given
    const firstTaskFunction = vi.fn(async (_ctx, task) => {
      if (task.retryCount < task.retry) {
        throw new Error(`something went wrong${task.retryCount}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstTask: Task = {
      title: 'task 1',
      task: firstTaskFunction,
      retry: 3,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      task 1 ..."
    `)
    expect(firstTask.retryCount).toBe(3)
    expect(firstTask.errors).toEqual([
      Error('something went wrong0'),
      Error('something went wrong1'),
      Error('something went wrong2'),
    ])
  })

  test('supports retrying up to a limit', async () => {
    // Given
    const firstTaskFunction = vi.fn(async (_ctx, task) => {
      if (task.retryCount <= task.retry) {
        throw new Error(`something went wrong${task.retryCount}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const secondTaskFunction = vi.fn(async () => {})

    const firstTask: Task = {
      title: 'task 1',
      task: firstTaskFunction,
      retry: 3,
    }

    const secondTask: Task = {
      title: 'task 2',
      task: secondTaskFunction,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot('""')
    expect(firstTask.retryCount).toBe(3)
    expect(firstTask.errors).toEqual([
      Error('something went wrong0'),
      Error('something went wrong1'),
      Error('something went wrong2'),
    ])
    expect(secondTaskFunction).toHaveBeenCalledTimes(0)
  })

  test('supports retrying a subtask', async () => {
    // Given
    const firstSubTaskFunction = vi.fn(async (_ctx, task) => {
      if (task.retryCount < task.retry) {
        throw new Error(`something went wrong${task.retryCount}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const firstSubTask: Task = {
      title: 'subtask 1',
      task: firstSubTaskFunction,
      retry: 3,
    }

    const firstTask: Task = {
      title: 'task 1',
      task: async () => {
        return [firstSubTask]
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      subtask 1 ..."
    `)
    expect(firstSubTask.retryCount).toBe(3)
    expect(firstSubTask.errors).toEqual([
      Error('something went wrong0'),
      Error('something went wrong1'),
      Error('something went wrong2'),
    ])
  })

  test('supports retrying a subtask up to a limit', async () => {
    // Given
    const firstSubTaskFunction = vi.fn(async (_ctx, task) => {
      if (task.retryCount <= task.retry) {
        throw new Error(`something went wrong${task.retryCount}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    const secondSubTaskFunction = vi.fn(async () => {})

    const firstSubTask: Task = {
      title: 'subtask 1',
      task: firstSubTaskFunction,
      retry: 3,
    }

    const secondSubTask: Task = {
      title: 'subtask 2',
      task: secondSubTaskFunction,
    }

    const firstTask: Task = {
      title: 'task 1',
      task: async () => {
        return [firstSubTask, secondSubTask]
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} />)

    await taskHasRendered()

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot('""')
    expect(firstSubTask.retryCount).toBe(3)
    expect(firstSubTask.errors).toEqual([
      Error('something went wrong0'),
      Error('something went wrong1'),
      Error('something went wrong2'),
    ])
    expect(secondSubTaskFunction).toHaveBeenCalledTimes(0)
  })

  test('has a context', async () => {
    // Given
    const firstTaskFunction = vi.fn(async (ctx) => {
      ctx.foo = 'bar'
    })

    const firstTask: Task<{foo: string}> = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    const secondTask: Task<{foo: string}> = {
      title: 'task 2',
      task: async (ctx) => {
        if (ctx.foo === 'bar') {
          throw new Error('context is shared')
        }
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} silent={false} />)

    // Then
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('context is shared')
  })

  test('has an onComplete function that is called with the context', async () => {
    // Given
    const taskFunction = vi.fn(async (ctx) => {
      ctx.foo = 'bar'
    })

    const task: Task<{foo: string}> = {
      title: 'task 1',
      task: taskFunction,
    }

    // When
    const context = await new Promise((resolve, _reject) => {
      render(<Tasks tasks={[task]} silent={false} onComplete={resolve} />)
    })

    // Then
    expect(context).toEqual({foo: 'bar'})
  })

  test('abortController can be used to exit from outside', async () => {
    // Given
    const abortController = new AbortController()

    const firstTaskFunction = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000))
    })

    const firstTask = {
      title: 'task 1',
      task: firstTaskFunction,
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} silent={false} abortSignal={abortController.signal} />)
    await taskHasRendered()
    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    // wait for the onAbort promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toEqual('')
    await expect(promise).resolves.toEqual(undefined)
  })
})

async function taskHasRendered() {
  await new Promise((resolve) => setTimeout(resolve, 100))
}
