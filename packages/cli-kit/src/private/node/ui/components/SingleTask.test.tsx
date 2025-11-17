import {SingleTask} from './SingleTask.js'
import {render} from '../../testing/ui.js'
import React from 'react'
import {describe, expect, test} from 'vitest'

describe('SingleTask', () => {
  test('unmounts when promise resolves successfully', async () => {
    // Given
    const title = 'Uploading files'
    let resolvePromise: (value: string) => void
    const task = () =>
      new Promise<string>((resolve) => {
        resolvePromise = resolve
      })

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)

    // Wait for initial render
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Resolve the promise
    resolvePromise!('success')

    // Wait for component to update and unmount
    await renderInstance.waitUntilExit()

    // Then - component should unmount cleanly
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('unmounts when promise rejects', async () => {
    // Given
    const title = 'Failed task'
    let rejectPromise: (error: Error) => void
    const task = () =>
      new Promise<string>((resolve, reject) => {
        rejectPromise = reject
      })

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)

    // Wait for initial render
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Reject the promise and expect waitUntilExit to reject
    rejectPromise!(new Error('Task failed'))

    // The component should exit with the error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Task failed')
  })

  test('handles promise that resolves immediately', async () => {
    // Given
    const title = 'Instant task'
    const task = () => Promise.resolve('immediate success')

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)
    await renderInstance.waitUntilExit()

    // Then - component should complete successfully
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('handles promise that rejects immediately', async () => {
    // Given
    const title = 'Instant failure'
    const task = () => Promise.reject(new Error('Immediate error'))

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)

    // Then - should exit with error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Immediate error')
  })

  test('handles different types of promise return values', async () => {
    // Test with string
    let stringResult: string | undefined
    const stringTask = () => Promise.resolve('task completed')
    const stringRender = render(
      <SingleTask title="String task" task={stringTask} onComplete={(result) => (stringResult = result)} />,
    )
    await stringRender.waitUntilExit()
    expect(stringRender.lastFrame()).toBeDefined()
    expect(stringResult).toBe('task completed')

    // Test with object
    let objectResult: {id: number; name: string} | undefined
    const objectTask = () => Promise.resolve({id: 1, name: 'test'})
    const objectRender = render(
      <SingleTask title="Object task" task={objectTask} onComplete={(result) => (objectResult = result)} />,
    )
    await objectRender.waitUntilExit()
    expect(objectRender.lastFrame()).toBeDefined()

    // Test with number
    let numberResult: number | undefined
    const numberTask = () => Promise.resolve(42)
    const numberRender = render(
      <SingleTask title="Number task" task={numberTask} onComplete={(result) => (numberResult = result)} />,
    )
    await numberRender.waitUntilExit()
    expect(numberRender.lastFrame()).toBeDefined()
    expect(numberResult).toBe(42)

    // Test with boolean
    let booleanResult: boolean | undefined
    const booleanTask = () => Promise.resolve(true)
    const booleanRender = render(
      <SingleTask title="Boolean task" task={booleanTask} onComplete={(result) => (booleanResult = result)} />,
    )
    await booleanRender.waitUntilExit()
    expect(booleanRender.lastFrame()).toBeDefined()
    expect(booleanResult).toBe(true)
  })

  test('handles promise with delayed resolution', async () => {
    // Given
    const title = 'Delayed task'
    const task = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('completed'), 100)
      })

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)

    // Wait for completion
    await renderInstance.waitUntilExit()

    // Then
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('handles promise with delayed rejection', async () => {
    // Given
    const title = 'Delayed failure'
    const task = () =>
      new Promise<string>((resolve, reject) => {
        setTimeout(() => reject(new Error('delayed error')), 100)
      })

    // When
    const renderInstance = render(<SingleTask title={title} task={task} />)

    // Wait for completion - should throw error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('delayed error')
  })

  test('preserves error types and messages', async () => {
    // Test with custom error
    class CustomError extends Error {
      constructor(message: string, public code: string) {
        super(message)
        this.name = 'CustomError'
      }
    }

    const customError = new CustomError('Custom error message', 'CUSTOM_CODE')
    const task = () => Promise.reject(customError)

    // When
    const renderInstance = render(<SingleTask title="Custom error task" task={task} />)

    // Then - should preserve the exact error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Custom error message')
  })

  test('handles concurrent promise operations', async () => {
    // Given - Multiple SingleTask components with different promises
    const fastPromise = () => new Promise((resolve) => setTimeout(() => resolve('fast'), 50))
    const slowPromise = () => new Promise((resolve) => setTimeout(() => resolve('slow'), 150))

    // When
    const fastRender = render(<SingleTask title="Fast task" task={fastPromise} />)
    const slowRender = render(<SingleTask title="Slow task" task={slowPromise} />)

    // Then - Both should complete successfully
    await fastRender.waitUntilExit()
    await slowRender.waitUntilExit()

    expect(fastRender.lastFrame()).toBeDefined()
    expect(slowRender.lastFrame()).toBeDefined()
  })

  test('passes noColor prop to LoadingBar component', async () => {
    // Given
    const title = 'No color task'
    const task = () => Promise.resolve()

    // When - Test that noColor prop doesn't break the component
    const renderInstance = render(<SingleTask title={title} task={task} noColor />)
    await renderInstance.waitUntilExit()

    // Then - Component should complete successfully with noColor prop
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('updates status message during task execution', async () => {
    // Given
    const initialTitle = 'Starting task'
    let step1Resolve: () => void
    let step2Resolve: () => void
    let step3Resolve: () => void

    const step1Promise = new Promise<void>((resolve) => {
      step1Resolve = resolve
    })
    const step2Promise = new Promise<void>((resolve) => {
      step2Resolve = resolve
    })
    const step3Promise = new Promise<void>((resolve) => {
      step3Resolve = resolve
    })

    const task = async (updateStatus: (status: string) => void) => {
      updateStatus('Running (1 complete)...')
      await step1Promise

      updateStatus('Running (2 complete)...')
      await step2Promise

      updateStatus('Running (3 complete)...')
      await step3Promise

      return 'completed'
    }

    // When
    const renderInstance = render(<SingleTask title={initialTitle} task={task} />)

    // Wait for component to render with first status
    await new Promise((resolve) => setTimeout(resolve, 10))
    const frame1 = renderInstance.lastFrame()
    expect(frame1).toContain('1 complete')

    // Progress to step 2
    step1Resolve!()
    await new Promise((resolve) => setTimeout(resolve, 10))
    const frame2 = renderInstance.lastFrame()
    expect(frame2).toContain('2 complete')

    // Progress to step 3
    step2Resolve!()
    await new Promise((resolve) => setTimeout(resolve, 10))
    const frame3 = renderInstance.lastFrame()
    expect(frame3).toContain('3 complete')

    // Complete the task
    step3Resolve!()
    await renderInstance.waitUntilExit()
  })
})
