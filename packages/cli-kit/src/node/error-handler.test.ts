import {errorHandler} from './error-handler'
import * as error from '../error'
import * as outputMocker from '../testing/output'
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
