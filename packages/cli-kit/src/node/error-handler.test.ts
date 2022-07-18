import {errorHandler, outputError} from './error-handler'
import {unstyled} from '../output.js'
import * as error from '../error'
import * as outputMocker from '../testing/output'
import {Bug, Abort} from '../error.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'

beforeEach(() => {
  vi.mock('node:process')
})

describe('errorHandler', () => {
  it('finishes the execution without exiting the proccess when cancel execution exception is raised', () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    // When
    errorHandler(new error.CancelExecution())

    // Then
    expect(process.exit).toBeCalledTimes(0)
  })

  it('finishes the execution without exiting the proccess and display a custom message when cancel execution exception is raised with a message', () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    errorHandler(new error.CancelExecution('Custom message'))

    // Then
    expect(outputMock.info()).toMatch('✨  Custom message')
    expect(process.exit).toBeCalledTimes(0)
  })

  it('finishes the execution gracefully and exits the proccess when abort silent exception', () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    // When
    errorHandler(new error.AbortSilent())

    // Then
    expect(process.exit).toBeCalledTimes(1)
    expect(process.exit).toBeCalledWith(1)
  })
})

beforeEach(() => {
  vi.mock('./output')
})

describe('outputError', () => {
  it('error output uses same input error instance when the error type is abort', async () => {
    // Given
    const abortError = new Abort('error message', 'try message')
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    await outputError(abortError)

    // Then
    expect(unstyled(outputMock.error())).toMatchInlineSnapshot(`
      "
      ━━━━━━ Error ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          error message

          What to try:
          try message

      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      "
    `)
    outputMock.clear()
  })

  it('error output uses same input error instance when the error type is bug', async () => {
    // Given
    const bugError = new Bug('error message', 'try message')
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    await outputError(bugError)

    // Then
    expect(unstyled(outputMock.error())).not.toBe('')
    outputMock.clear()
  })

  it('error output uses a Bug instance instance when the error type not extends from fatal', async () => {
    // Given
    const unknownError = new Error('Unknown')
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    await outputError(unknownError)

    // Then
    expect(unstyled(outputMock.error())).not.toBe('')
    outputMock.clear()
  })
})
