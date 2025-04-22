import {PortWarning, renderPortWarnings} from './port-warnings.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'

describe('renderPortWarnings()', () => {
  test('does not call renderWarning when no warnings', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portWarnings: PortWarning[] = []

    // When
    mockOutput.clear()
    renderPortWarnings(portWarnings)

    // Then
    expect(mockOutput.warn()).toBe('')
  })

  test('calls renderWarning when there is a warning', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portWarnings: PortWarning[] = [
      {
        type: 'localhost',
        flag: '--localhost-port',
        requestedPort: 1234,
      },
    ]

    // When
    mockOutput.clear()
    renderPortWarnings(portWarnings)

    // Then
    expect(mockOutput.warn()).toContain('A random port will be used for localhost because 1234 is not available.')
    expect(mockOutput.warn()).toContain('If you want to use a specific port, you can choose a different one by')
    expect(mockOutput.warn()).toContain('setting the  `--localhost-port`  flag.')
  })

  test('Combines warnings when there are multiple', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const portWarnings: PortWarning[] = [
      {
        type: 'localhost',
        flag: '--localhost-port',
        requestedPort: 1234,
      },
      {
        type: 'GraphiQL',
        flag: '--graphiql-port',
        requestedPort: 5678,
      },
    ]

    // When
    mockOutput.clear()
    renderPortWarnings(portWarnings)

    // Then
    expect(mockOutput.warn()).toContain('Random ports will be used for localhost and GraphiQL because the requested')
    expect(mockOutput.warn()).toContain('ports are not available')
    expect(mockOutput.warn()).toContain('If you want to use specific ports, you can choose different ports using')
    expect(mockOutput.warn()).toContain('the `--localhost-port` and `--graphiql-port` flags.')
  })
})
