import StoreCreateDev from './dev.js'
import {createDevStore} from '../../../services/store/create/dev.js'
import {storeNamePrompt, storePlanPrompt} from '../../../prompts/store.js'
import {selectOrg} from '@shopify/organizations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../../services/store/create/dev.js')
vi.mock('../../../prompts/store.js')
vi.mock('@shopify/cli-kit/node/system')

vi.mock('@shopify/organizations', () => ({
  selectOrg: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

const defaultOrg = {id: '12345', businessName: 'Test Org'}

beforeEach(() => {
  vi.mocked(selectOrg).mockResolvedValue(defaultOrg)
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
})

describe('store create dev command', () => {
  test('resolves the organization and passes parsed flags through to the service', async () => {
    await StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345'])

    expect(selectOrg).toHaveBeenCalledWith('12345')
    expect(createDevStore).toHaveBeenCalledWith({
      name: 'my-test-store',
      organization: defaultOrg,
      plan: 'plus',
      featurePreview: undefined,
      withDemoData: false,
      json: false,
    })
  })

  test('passes json flag through to the service', async () => {
    await StoreCreateDev.run(['--name', 'my-test-store', '--json', '--plan', 'plus', '--organization-id', '12345'])

    expect(createDevStore).toHaveBeenCalledWith({
      name: 'my-test-store',
      organization: defaultOrg,
      plan: 'plus',
      featurePreview: undefined,
      withDemoData: false,
      json: true,
    })
  })

  test('passes plan, feature-preview, and with-demo-data flags through to the service', async () => {
    await StoreCreateDev.run([
      '--name',
      'my-test-store',
      '--plan',
      'basic',
      '--organization-id',
      '12345',
      '--feature-preview',
      'extended_variants',
      '--with-demo-data',
    ])

    expect(createDevStore).toHaveBeenCalledWith({
      name: 'my-test-store',
      organization: defaultOrg,
      plan: 'basic',
      featurePreview: 'extended_variants',
      withDemoData: true,
      json: false,
    })
  })

  test('prompts for the name when --name is omitted in an interactive environment', async () => {
    vi.mocked(storeNamePrompt).mockResolvedValue('prompted-store')

    await StoreCreateDev.run(['--organization-id', '12345', '--plan', 'plus'])

    expect(storeNamePrompt).toHaveBeenCalled()
    expect(createDevStore).toHaveBeenCalledWith(expect.objectContaining({name: 'prompted-store'}))
  })

  test('prompts for the plan when --plan is omitted in an interactive environment', async () => {
    vi.mocked(storePlanPrompt).mockResolvedValue('advanced')

    await StoreCreateDev.run(['--organization-id', '12345', '--name', 'my-test-store'])

    expect(storePlanPrompt).toHaveBeenCalled()
    expect(createDevStore).toHaveBeenCalledWith(expect.objectContaining({plan: 'advanced'}))
  })

  test('does not prompt when all flags are provided', async () => {
    await StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345'])

    expect(storeNamePrompt).not.toHaveBeenCalled()
    expect(storePlanPrompt).not.toHaveBeenCalled()
  })

  test('rejects an invalid plan value without calling the service', async () => {
    await expect(
      StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'enterprise', '--organization-id', '12345']),
    ).rejects.toThrow()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test.each(['name', 'organization-id', 'plan'])(
    'fails in a non-interactive environment when --%s is missing',
    async (missingFlag) => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const argv = ['--name', 'my-test-store', '--organization-id', '12345', '--plan', 'plus'].filter(
        (value, index, all) => {
          // Drop the missing flag and its value.
          if (value === `--${missingFlag}`) return false
          return all[index - 1] !== `--${missingFlag}`
        },
      )
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit')
      }) as never)

      await expect(StoreCreateDev.run(argv)).rejects.toThrow()
      expect(createDevStore).not.toHaveBeenCalled()

      mockExit.mockRestore()
    },
  )

  test('defines the expected flags', () => {
    expect(StoreCreateDev.flags.name).toBeDefined()
    expect(StoreCreateDev.flags['organization-id']).toBeDefined()
    expect(StoreCreateDev.flags.plan).toBeDefined()
    expect(StoreCreateDev.flags['feature-preview']).toBeDefined()
    expect(StoreCreateDev.flags['with-demo-data']).toBeDefined()
    expect(StoreCreateDev.flags.json).toBeDefined()
  })

  test('outputs structured JSON error when --json is active and service throws AbortError', async () => {
    vi.mocked(createDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(
      StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345', '--json']),
    ).rejects.toThrow('process.exit')

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    const parsed = JSON.parse(call)
    expect(parsed).toEqual({
      error: true,
      message: 'Something went wrong',
      nextSteps: [],
      exitCode: 1,
    })
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  test('does not output JSON for non-AbortError even when --json is active', async () => {
    vi.mocked(createDevStore).mockRejectedValueOnce(new Error('unexpected'))

    await expect(
      StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345', '--json']),
    ).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })

  test('does not output JSON for AbortError when --json is not active', async () => {
    vi.mocked(createDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))

    await expect(
      StoreCreateDev.run(['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345']),
    ).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })
})
