import {simpleTask} from './ui.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {describe, expect, it, vi} from 'vitest'

describe('simpleTask()', () => {
  it('outputs correctly using success property when successful', async () => {
    // Given
    const title = 'Starting the task'
    const success = 'Finished the task'
    const task = vi.fn(() => Promise.resolve())
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await simpleTask({title, success, task})

    // Then
    expect(outputMock.started()).toMatch('Starting the task')
    expect(outputMock.completed()).toMatch('Finished the task')
    expect(outputMock.failed()).not.toBeDefined()
  })
  it('outputs correctly using result of task when successful', async () => {
    // Given
    const title = 'Starting the task'
    const task = vi.fn(() => Promise.resolve('Finished the task (created X and Y)'))
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await simpleTask({title, task})

    // Then
    expect(outputMock.started()).toMatch('Starting the task')
    expect(outputMock.completed()).toMatch('Finished the task (created X and Y)')
    expect(outputMock.failed()).not.toBeDefined()
  })
  it('outputs correctly when unsuccessful', async () => {
    // Given
    const title = 'Starting the task'
    const success = 'Finished the task'
    const task = vi.fn(() => Promise.reject(new Error('An error')))
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await expect(simpleTask({title, success, task})).rejects.toThrow('An error')

    // Then
    expect(outputMock.started()).toMatch('Starting the task')
    expect(outputMock.completed()).not.toBeDefined()
    expect(outputMock.failed()).toMatch('Starting the task')
  })
})
