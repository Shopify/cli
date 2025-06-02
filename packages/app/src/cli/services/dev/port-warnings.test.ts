import {PortDetail, renderPortWarnings} from './port-warnings.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'

describe('renderPortWarnings()', () => {
  test('does not call renderWarning when no port details', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portDetails: PortDetail[] = []

    // When
    mockOutput.clear()
    renderPortWarnings(portDetails)

    // Then
    expect(mockOutput.warn()).toBe('')
  })

  test('does not call renderWarning when request & actual ports match', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portDetails: PortDetail[] = [
      {
        for: 'GraphiQL',
        flagToRemedy: '--graphiql-port',
        requested: 5678,
        actual: 5678,
      },
      {
        for: 'localhost',
        flagToRemedy: '--localhost-port',
        requested: 1234,
        actual: 1234,
      },
    ]

    // When
    mockOutput.clear()
    renderPortWarnings(portDetails)

    // Then
    expect(mockOutput.warn()).toBe('')
  })

  test('calls renderWarning once when there is one warning', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portDetails: PortDetail[] = [
      {
        for: 'GraphiQL',
        flagToRemedy: '--graphiql-port',
        requested: 4321,
        actual: 4321,
      },
      {
        for: 'localhost',
        flagToRemedy: '--localhost-port',
        requested: 1234,
        actual: 4567,
      },
    ]

    // When
    mockOutput.clear()
    renderPortWarnings(portDetails)

    // Then
    expect(mockOutput.warn()).toContain('A random port will be used for localhost because 1234 is not available.')
    expect(mockOutput.warn()).toContain('If you want to use a specific port, you can choose a different one by')
    expect(mockOutput.warn()).toContain('setting the `--localhost-port` flag.')
  })

  test('Calls renderWarning once, combining warnings when there are multiple warnings', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portDetails: PortDetail[] = [
      {
        for: 'localhost',
        flagToRemedy: '--localhost-port',
        requested: 4567,
        actual: 7654,
      },
      {
        for: 'GraphiQL',
        flagToRemedy: '--graphiql-port',
        requested: 1234,
        actual: 4321,
      },
    ]

    // When
    mockOutput.clear()
    renderPortWarnings(portDetails)

    // Then
    expect(mockOutput.warn()).toContain('Random ports will be used for localhost and GraphiQL because the requested')
    expect(mockOutput.warn()).toContain('ports are not available')
    expect(mockOutput.warn()).toContain('If you want to use specific ports, you can choose different ports using')
    expect(mockOutput.warn()).toContain('the `--localhost-port` and `--graphiql-port` flags.')
  })
})
