import {SingleTask} from './SingleTask.js'
import {render} from '../../testing/ui.js'
import React from 'react'
import {describe, expect, test} from 'vitest'

describe('SingleTask', () => {
  test('unmounts when promise resolves successfully', async () => {
    // Given
    const title = 'Uploading files'
    let resolvePromise: (value: string) => void
    const taskPromise = new Promise<string>((resolve) => {
      resolvePromise = resolve
    })

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)

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
    const taskPromise = new Promise<string>((resolve, reject) => {
      rejectPromise = reject
    })

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)

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
    const taskPromise = Promise.resolve('immediate success')

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)
    await renderInstance.waitUntilExit()

    // Then - component should complete successfully
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('handles promise that rejects immediately', async () => {
    // Given
    const title = 'Instant failure'
    const taskPromise = Promise.reject(new Error('Immediate error'))

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)

    // Then - should exit with error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Immediate error')
  })

  test('handles different types of promise return values', async () => {
    // Test with string
    const stringTask = Promise.resolve('task completed')
    const stringRender = render(<SingleTask title="String task" taskPromise={stringTask} />)
    await stringRender.waitUntilExit()
    expect(stringRender.lastFrame()).toBeDefined()

    // Test with object
    const objectTask = Promise.resolve({id: 1, name: 'test'})
    const objectRender = render(<SingleTask title="Object task" taskPromise={objectTask} />)
    await objectRender.waitUntilExit()
    expect(objectRender.lastFrame()).toBeDefined()

    // Test with number
    const numberTask = Promise.resolve(42)
    const numberRender = render(<SingleTask title="Number task" taskPromise={numberTask} />)
    await numberRender.waitUntilExit()
    expect(numberRender.lastFrame()).toBeDefined()

    // Test with boolean
    const booleanTask = Promise.resolve(true)
    const booleanRender = render(<SingleTask title="Boolean task" taskPromise={booleanTask} />)
    await booleanRender.waitUntilExit()
    expect(booleanRender.lastFrame()).toBeDefined()
  })

  test('handles promise with delayed resolution', async () => {
    // Given
    const title = 'Delayed task'
    const taskPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('completed'), 100)
    })

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)

    // Wait for completion
    await renderInstance.waitUntilExit()

    // Then
    expect(renderInstance.lastFrame()).toBeDefined()
  })

  test('handles promise with delayed rejection', async () => {
    // Given
    const title = 'Delayed failure'
    const taskPromise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(new Error('delayed error')), 100)
    })

    // When
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} />)

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
    const taskPromise = Promise.reject(customError)

    // When
    const renderInstance = render(<SingleTask title="Custom error task" taskPromise={taskPromise} />)

    // Then - should preserve the exact error
    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Custom error message')
  })

  test('handles concurrent promise operations', async () => {
    // Given - Multiple SingleTask components with different promises
    const fastPromise = new Promise((resolve) => setTimeout(() => resolve('fast'), 50))
    const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 150))

    // When
    const fastRender = render(<SingleTask title="Fast task" taskPromise={fastPromise} />)
    const slowRender = render(<SingleTask title="Slow task" taskPromise={slowPromise} />)

    // Then - Both should complete successfully
    await fastRender.waitUntilExit()
    await slowRender.waitUntilExit()

    expect(fastRender.lastFrame()).toBeDefined()
    expect(slowRender.lastFrame()).toBeDefined()
  })

  test('passes noColor prop to LoadingBar component', async () => {
    // Given
    const title = 'No color task'
    const taskPromise = Promise.resolve()

    // When - Test that noColor prop doesn't break the component
    const renderInstance = render(<SingleTask title={title} taskPromise={taskPromise} noColor />)
    await renderInstance.waitUntilExit()

    // Then - Component should complete successfully with noColor prop
    expect(renderInstance.lastFrame()).toBeDefined()
  })
})
