import AgentSessionStart from './start.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {startAgentSession} from '@shopify/cli-kit/node/agent'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {randomUUID} from 'crypto'

vi.mock('@shopify/cli-kit/node/agent')
vi.mock('crypto', () => ({
  randomUUID: vi.fn(),
}))

describe('AgentSessionStart', () => {
  const mockUuid = '00000000-0000-4000-8000-000000000001'
  const mockSessionId = `conv_${mockUuid}`
  const mockSession = {
    sessionId: mockSessionId,
    startedAt: '2024-01-15T10:00:00.000Z',
    agentName: 'test-agent',
    agentVersion: '1.2.3',
    agentProvider: 'test-provider',
    metricsMode: 'on' as const,
    defaultNonInteractive: false,
  }

  beforeEach(() => {
    vi.mocked(randomUUID).mockReturnValue(mockUuid)
    vi.mocked(startAgentSession).mockReturnValue(mockSession)
  })

  test('starts an agent session with required flags', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AgentSessionStart.run(
      ['--agent', 'test-agent', '--agent-version', '1.2.3', '--provider', 'test-provider', '--metrics', 'on'],
      import.meta.url,
    )

    // Then
    expect(vi.mocked(startAgentSession)).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      agentName: 'test-agent',
      agentVersion: '1.2.3',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: false,
    })

    expect(outputMock.info()).toContain('Agent session started:')
    expect(outputMock.info()).toContain(`Session ID: ${mockSessionId}`)
    expect(outputMock.info()).toContain('Agent: test-agent')
    expect(outputMock.info()).toContain('Version: 1.2.3')
    expect(outputMock.info()).toContain('Provider: test-provider')
    expect(outputMock.info()).toContain('Metrics: on')
    expect(outputMock.info()).toContain('Default non-interactive: false')
  })

  test('starts an agent session with metrics off', async () => {
    // Given
    const sessionWithMetricsOff = {...mockSession, metricsMode: 'off' as const}
    vi.mocked(startAgentSession).mockReturnValue(sessionWithMetricsOff)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AgentSessionStart.run(
      ['--agent', 'test-agent', '--agent-version', '1.2.3', '--provider', 'test-provider', '--metrics', 'off'],
      import.meta.url,
    )

    // Then
    expect(vi.mocked(startAgentSession)).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      agentName: 'test-agent',
      agentVersion: '1.2.3',
      agentProvider: 'test-provider',
      metricsMode: 'off',
      defaultNonInteractive: false,
    })

    expect(outputMock.info()).toContain('Metrics: off')
  })

  test('starts an agent session with default-non-interactive flag', async () => {
    // Given
    const sessionWithNonInteractive = {...mockSession, defaultNonInteractive: true}
    vi.mocked(startAgentSession).mockReturnValue(sessionWithNonInteractive)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AgentSessionStart.run(
      [
        '--agent',
        'test-agent',
        '--agent-version',
        '1.2.3',
        '--provider',
        'test-provider',
        '--metrics',
        'on',
        '--default-non-interactive',
      ],
      import.meta.url,
    )

    // Then
    expect(vi.mocked(startAgentSession)).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      agentName: 'test-agent',
      agentVersion: '1.2.3',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: true,
    })

    expect(outputMock.info()).toContain('Default non-interactive: true')
  })

  test('outputs JSON when --json flag is provided', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AgentSessionStart.run(
      ['--agent', 'test-agent', '--agent-version', '1.2.3', '--provider', 'test-provider', '--metrics', 'on', '--json'],
      import.meta.url,
    )

    // Then
    const output = outputMock.output()
    const jsonOutput = JSON.parse(output)

    expect(jsonOutput).toEqual(mockSession)
    expect(jsonOutput.sessionId).toBe(mockSessionId)
    expect(jsonOutput.agentName).toBe('test-agent')
    expect(jsonOutput.agentVersion).toBe('1.2.3')
    expect(jsonOutput.agentProvider).toBe('test-provider')
    expect(jsonOutput.metricsMode).toBe('on')
    expect(jsonOutput.defaultNonInteractive).toBe(false)
  })

  test('generates unique session ID using randomUUID', async () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('00000000-0000-4000-8000-000000000002')
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AgentSessionStart.run(
      ['--agent', 'test-agent', '--agent-version', '1.2.3', '--provider', 'test-provider', '--metrics', 'on'],
      import.meta.url,
    )

    // Then
    expect(vi.mocked(startAgentSession)).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'conv_00000000-0000-4000-8000-000000000002',
      }),
    )
  })
})
