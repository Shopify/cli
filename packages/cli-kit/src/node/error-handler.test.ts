import {errorHandler, cleanStackFrameFilePath} from './error-handler'
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

describe('bugsnag stack cleaning', () => {
  it.each([
    ['plugin in project', 'node_modules/@plugin/name/foo/bar.ts', '@plugin/name/foo/bar.ts'],
    ['plugin outside project', '/global/node_modules/@plugin/global/foo/bar.ts', '@plugin/global/foo/bar.ts'],
    ['some relative path', 'users/own/code.ts', 'users/own/code.ts'],
    ['some absolute path', '/global/code.ts', '/global/code.ts'],
    [
      'plugin in a complex location',
      'node_modules/.something/@plugin+complex/@plugin/complex-path/foo/bar.ts',
      '@plugin/complex-path/foo/bar.ts',
    ],
  ])('%s', (_, path, result) => {
    expect(
      cleanStackFrameFilePath({
        currentFilePath: path,
        projectRoot: '/my/project',
        pluginLocations: [
          {
            name: '@plugin/name',
            pluginPath: '/my/project/node_modules/@plugin/name',
          },
          {
            name: '@plugin/global',
            pluginPath: '/global/node_modules/@plugin/global',
          },
          {
            name: '@plugin/complex-path',
            pluginPath: '/my/project/node_modules/.something/@plugin+complex/@plugin/complex-path',
          },
        ],
      }),
    ).toEqual(result)
  })
})
