import Release from './release.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {renderWarning} from '@shopify/cli-kit/node/ui'

vi.mock('../../services/release.js')
vi.mock('../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()
  return {...actual, addPublicMetadata: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()
  return {...actual, renderWarning: vi.fn()}
})

describe('app release --force deprecation warning', () => {
  beforeEach(async () => {
    const {linkedAppContext} = await import('../../services/app-context.js')
    const {release} = await import('../../services/release.js')
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: testDeveloperPlatformClient(),
      organization: {id: '1', businessName: 'test', website: '', apps: {nodes: []}, zeroPartyData: false, appsNext: false},
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
    expect(JSON.stringify(call)).toContain('4.0')
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

  test('does not show deprecation warning when no force flags are passed', async () => {
    await Release.run(['--version', 'v1.0.0', '--allow-updates'])

    expect(renderWarning).not.toHaveBeenCalled()
  })
})
