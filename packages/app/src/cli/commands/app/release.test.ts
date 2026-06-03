import Release from './release.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {OrganizationSource} from '../../models/organization.js'
import {linkedAppContext} from '../../services/app-context.js'
import {release} from '../../services/release.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as agent from '@shopify/cli-kit/node/agent'
import {renderWarning} from '@shopify/cli-kit/node/ui'

vi.mock('../../services/release.js')
vi.mock('../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('app release --force deprecation warning', () => {
  beforeEach(() => {
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: testDeveloperPlatformClient(),
      organization: {
        id: '1',
        businessName: 'test',
        source: OrganizationSource.Partners,
      },
      specifications: [],
      project: {} as any,
      activeConfig: {} as any,
    })
    vi.mocked(release).mockResolvedValue(undefined)
  })

  test('shows deprecation warning when --force is passed', async () => {
    await Release.run(['--version', 'v1.0.0', '--force'])

    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.arrayContaining(['The']),
        body: expect.arrayContaining(['Use']),
      }),
    )
    const call = vi.mocked(renderWarning).mock.calls[0]![0]
    expect(JSON.stringify(call)).toContain('--force')
    expect(JSON.stringify(call)).toContain('next major release')
  })

  test('shows deprecation warning when SHOPIFY_FLAG_FORCE env var is set', async () => {
    vi.stubEnv('SHOPIFY_FLAG_FORCE', '1')

    await Release.run(['--version', 'v1.0.0'])

    expect(renderWarning).toHaveBeenCalled()
    const call = vi.mocked(renderWarning).mock.calls[0]![0]
    expect(JSON.stringify(call)).toContain('--force')

    vi.unstubAllEnvs()
  })

  test('does not show deprecation warning when only --allow-updates is passed', async () => {
    await Release.run(['--version', 'v1.0.0', '--allow-updates'])

    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('does not show deprecation warning when --allow-updates and --allow-deletes are passed', async () => {
    await Release.run(['--version', 'v1.0.0', '--allow-updates', '--allow-deletes'])

    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('does not show deprecation warning when only --allow-deletes is passed', async () => {
    await Release.run(['--version', 'v1.0.0', '--allow-deletes'])

    expect(renderWarning).not.toHaveBeenCalled()
  })
})

describe('app release agent session behavior', () => {
  beforeEach(() => {
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: testDeveloperPlatformClient(),
      organization: {
        id: '1',
        businessName: 'test',
        source: OrganizationSource.Partners,
      },
      specifications: [],
      project: {} as any,
      activeConfig: {} as any,
    })
    vi.mocked(release).mockResolvedValue(undefined)
    vi.spyOn(agent, 'getCurrentAgentSession').mockReturnValue(undefined)
  })

  test('applies --allow-updates when agent session with defaultNonInteractive=true exists and no explicit flags', async () => {
    vi.mocked(agent.getCurrentAgentSession).mockReturnValue({
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      agentName: 'test-agent',
      agentVersion: '1.0.0',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: true,
    })

    await Release.run(['--version', 'v1.0.0'])

    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        allowUpdates: true,
        allowDeletes: undefined,
      }),
    )
  })

  test('explicit --allow-updates flag wins over agent session', async () => {
    vi.mocked(agent.getCurrentAgentSession).mockReturnValue({
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      agentName: 'test-agent',
      agentVersion: '1.0.0',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: true,
    })

    await Release.run(['--version', 'v1.0.0', '--allow-updates'])

    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        allowUpdates: true,
        allowDeletes: undefined,
      }),
    )
  })

  test('explicit --allow-deletes does not trigger --allow-updates from agent session', async () => {
    vi.mocked(agent.getCurrentAgentSession).mockReturnValue({
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      agentName: 'test-agent',
      agentVersion: '1.0.0',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: true,
    })

    await Release.run(['--version', 'v1.0.0', '--allow-deletes'])

    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        allowUpdates: false,
        allowDeletes: true,
      }),
    )
  })

  test('no behavior change when agent session exists but defaultNonInteractive=false', async () => {
    vi.mocked(agent.getCurrentAgentSession).mockReturnValue({
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      agentName: 'test-agent',
      agentVersion: '1.0.0',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: false,
    })

    await Release.run(['--version', 'v1.0.0', '--allow-updates'])

    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        allowUpdates: true,
        allowDeletes: undefined,
      }),
    )
  })

  test('explicit --force flag works with agent session', async () => {
    vi.mocked(agent.getCurrentAgentSession).mockReturnValue({
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      agentName: 'test-agent',
      agentVersion: '1.0.0',
      agentProvider: 'test-provider',
      metricsMode: 'on',
      defaultNonInteractive: true,
    })

    await Release.run(['--version', 'v1.0.0', '--force'])

    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        allowUpdates: true,
        allowDeletes: true,
        force: true,
      }),
    )
  })
})
