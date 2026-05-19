import {describe, expect, test, beforeEach, afterEach, vi} from 'vitest'
import {
  startAgentSession,
  getCurrentAgentSession,
  clearAgentSession,
  packAgentInfo,
  packAgentIds,
  AgentSession,
} from './agent.js'
import {
  getAgentSession,
  setAgentSession,
  removeAgentSession,
  ConfSchema,
} from '../../private/node/conf-store.js'
import {LocalStorage} from './local-storage.js'
import {inTemporaryDirectory} from './fs.js'
import {isLocalEnvironment} from '../../private/node/context/service.js'

vi.mock('../../private/node/context/service.js')

beforeEach(() => {
  vi.mocked(isLocalEnvironment).mockReturnValue(false)
  delete process.env.SHOPIFY_CLI_AGENT_INFO
  delete process.env.SHOPIFY_CLI_AGENT_IDS
})

afterEach(() => {
  delete process.env.SHOPIFY_CLI_AGENT_INFO
  delete process.env.SHOPIFY_CLI_AGENT_IDS
})

describe('startAgentSession', () => {
  test('persists a new agent session with all options', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      startAgentSession({
        sessionId: 'conv_123',
        agentName: 'test-agent',
        agentVersion: '1.0.0',
        agentProvider: 'test-provider',
        metricsMode: 'on',
        defaultNonInteractive: true,
      }, config)

      // Then
      const session = getAgentSession(config)
      expect(session).toBeDefined()
      expect(session?.sessionId).toBe('conv_123')
      expect(session?.agentName).toBe('test-agent')
      expect(session?.agentVersion).toBe('1.0.0')
      expect(session?.agentProvider).toBe('test-provider')
      expect(session?.metricsMode).toBe('on')
      expect(session?.defaultNonInteractive).toBe(true)
      expect(session?.startedAt).toBeDefined()
    })
  })

  test('uses default values for optional fields', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      startAgentSession({
        sessionId: 'conv_456',
        agentName: 'another-agent',
        agentVersion: '2.0.0',
        agentProvider: 'another-provider',
      }, config)

      // Then
      const session = getAgentSession(config)
      expect(session?.metricsMode).toBe('on')
      expect(session?.defaultNonInteractive).toBe(false)
    })
  })

  test('sets startedAt timestamp', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const beforeTime = new Date().toISOString()

      // When
      startAgentSession({
        sessionId: 'conv_789',
        agentName: 'time-agent',
        agentVersion: '3.0.0',
        agentProvider: 'time-provider',
      }, config)

      // Then
      const session = getAgentSession(config)
      const afterTime = new Date().toISOString()
      expect(session?.startedAt).toBeDefined()
      expect(session!.startedAt >= beforeTime).toBe(true)
      expect(session!.startedAt <= afterTime).toBe(true)
    })
  })
})

describe('getCurrentAgentSession', () => {
  test('returns undefined when no session is active', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      const session = getCurrentAgentSession(config)

      // Then
      expect(session).toBeUndefined()
    })
  })

  test('returns the current agent session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_current',
        startedAt: '2024-01-01T00:00:00Z',
        agentName: 'current-agent',
        agentVersion: '1.0.0',
        agentProvider: 'current-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)

      // When
      const session = getCurrentAgentSession(config)

      // Then
      expect(session).toEqual(mockSession)
    })
  })
})

describe('clearAgentSession', () => {
  test('removes the persisted agent session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_clear',
        startedAt: '2024-01-01T00:00:00Z',
        agentName: 'clear-agent',
        agentVersion: '1.0.0',
        agentProvider: 'clear-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)
      expect(getAgentSession(config)).toBeDefined()

      // When
      clearAgentSession(config)

      // Then
      expect(getAgentSession(config)).toBeUndefined()
    })
  })

  test('does nothing when no session exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When/Then - should not throw
      expect(() => clearAgentSession(config)).not.toThrow()
    })
  })
})

describe('packAgentInfo', () => {
  test('returns undefined when no session is active and no env var', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      const packed = packAgentInfo(undefined, config)

      // Then
      expect(packed).toBeUndefined()
    })
  })

  test('packs agent info from current session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_pack',
        startedAt: '2024-01-01T00:00:00Z',
        agentName: 'pack-agent',
        agentVersion: '1.2.3',
        agentProvider: 'pack-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)

      // When
      const packed = packAgentInfo(undefined, config)

      // Then
      expect(packed).toBe('n:pack-agent|v:1.2.3|p:pack-provider')
    })
  })

  test('packs agent info from provided session', () => {
    // Given
    const mockSession: AgentSession = {
      sessionId: 'conv_provided',
      startedAt: '2024-01-01T00:00:00Z',
      agentName: 'provided-agent',
      agentVersion: '4.5.6',
      agentProvider: 'provided-provider',
      metricsMode: 'off',
      defaultNonInteractive: true,
    }

    // When
    const packed = packAgentInfo(mockSession)

    // Then
    expect(packed).toBe('n:provided-agent|v:4.5.6|p:provided-provider')
  })

  test('prefers explicit SHOPIFY_CLI_AGENT_INFO env var over session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_env',
        startedAt: '2024-01-01T00:00:00Z',
        agentName: 'session-agent',
        agentVersion: '1.0.0',
        agentProvider: 'session-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)
      process.env.SHOPIFY_CLI_AGENT_INFO = 'n:env-agent|v:9.9.9|p:env-provider'

      // When
      const packed = packAgentInfo(undefined, config)

      // Then
      expect(packed).toBe(process.env.SHOPIFY_CLI_AGENT_INFO)
      expect(packed).toBe('n:env-agent|v:9.9.9|p:env-provider')
    })
  })
})

describe('packAgentIds', () => {
  test('returns undefined when no session is active and no env var', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      const packed = packAgentIds(undefined, config)

      // Then
      expect(packed).toBeUndefined()
    })
  })

  test('packs agent IDs from current session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_ids',
        startedAt: '2024-02-15T10:30:00Z',
        agentName: 'ids-agent',
        agentVersion: '1.0.0',
        agentProvider: 'ids-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)

      // When
      const packed = packAgentIds(undefined, config)

      // Then
      expect(packed).toBe('s:conv_ids')
    })
  })

  test('packs agent IDs from provided session', () => {
    // Given
    const mockSession: AgentSession = {
      sessionId: 'conv_provided_ids',
      startedAt: '2024-03-20T15:45:00Z',
      agentName: 'provided-ids-agent',
      agentVersion: '2.0.0',
      agentProvider: 'provided-ids-provider',
      metricsMode: 'off',
      defaultNonInteractive: true,
    }

    // When
    const packed = packAgentIds(mockSession)

    // Then
    expect(packed).toBe('s:conv_provided_ids')
  })

  test('prefers explicit SHOPIFY_CLI_AGENT_IDS env var over session', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const mockSession: AgentSession = {
        sessionId: 'conv_session_ids',
        startedAt: '2024-01-01T00:00:00Z',
        agentName: 'session-agent',
        agentVersion: '1.0.0',
        agentProvider: 'session-provider',
        metricsMode: 'on',
        defaultNonInteractive: false,
      }
      setAgentSession(mockSession, config)
      process.env.SHOPIFY_CLI_AGENT_IDS = 's:conv_env_ids'

      // When
      const packed = packAgentIds(undefined, config)

      // Then
      expect(packed).toBe(process.env.SHOPIFY_CLI_AGENT_IDS)
      expect(packed).toBe('s:conv_env_ids')
    })
  })
})
