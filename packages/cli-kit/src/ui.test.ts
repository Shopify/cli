import {task} from './ui.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {describe, expect, it, vi} from 'vitest'

describe('task()', () => {
  it('outputs correctly using result of task when successful', async () => {
    // Given
    const title = 'Starting the task'
    const taskFunc = vi.fn(() => Promise.resolve({successMessage: 'Finished the task (created X and Y)'}))
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await task({title, task: taskFunc})

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"❯ Starting the task"')
    expect(outputMock.completed()).toMatchInlineSnapshot('"Finished the task (created X and Y)"')
  })

  it('outputs correctly using original title as default when successful', async () => {
    // Given
    const title = 'Setup configuration'
    const taskFunc = vi.fn(() => Promise.resolve())
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await task({title, task: taskFunc})

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"❯ Setup configuration"')
    expect(outputMock.completed()).toMatchInlineSnapshot('"Setup configuration"')
  })

  it('outputs correctly when unsuccessful', async () => {
    // Given
    const title = 'Starting the task'
    const taskFunc = vi.fn(() => Promise.reject(new Error('An error')))
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await expect(task({title, task: taskFunc})).rejects.toThrow('An error')

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"❯ Starting the task\n✖ Starting the task"')
  })
})
