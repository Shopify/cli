import StoreDelete from './delete.js'
import {deleteDevStore} from '../../services/store/delete/dev.js'
import {resolveOrganizationForStore} from '../../utilities/store-lookup/organization.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {isTTY, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../services/store/delete/dev.js')
vi.mock('../../utilities/store-lookup/organization.js')

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    isTTY: vi.fn(),
    renderDangerousConfirmationPrompt: vi.fn(),
  }
})

const defaultOrg = {id: '12345', businessName: 'Test Org'}

beforeEach(() => {
  vi.mocked(resolveOrganizationForStore).mockResolvedValue(defaultOrg)
  vi.mocked(isTTY).mockReturnValue(true)
  vi.mocked(renderDangerousConfirmationPrompt).mockResolvedValue(true)
})

describe('store delete command', () => {
  test('resolves the organization and passes parsed flags through to the service', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345'])

    expect(resolveOrganizationForStore).toHaveBeenCalledWith('my-store.myshopify.com', '12345')
    expect(deleteDevStore).toHaveBeenCalledWith({
      store: 'my-store.myshopify.com',
      organization: defaultOrg,
      json: false,
    })
  })

  test('normalizes the store flag before passing it to the service', async () => {
    await StoreDelete.run(['--store', 'my-store', '--organization-id', '12345'])

    expect(deleteDevStore).toHaveBeenCalledWith(expect.objectContaining({store: 'my-store.myshopify.com'}))
  })

  test('passes json flag through to the service', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--json', '--organization-id', '12345'])

    expect(deleteDevStore).toHaveBeenCalledWith({
      store: 'my-store.myshopify.com',
      organization: defaultOrg,
      json: true,
    })
  })

  test('resolves the organization without an ID when --organization-id is omitted', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com'])

    expect(resolveOrganizationForStore).toHaveBeenCalledWith('my-store.myshopify.com', undefined)
    expect(deleteDevStore).toHaveBeenCalledWith(expect.objectContaining({organization: defaultOrg}))
  })

  test('defines the expected flags', () => {
    expect(StoreDelete.flags.store).toBeDefined()
    expect(StoreDelete.flags['organization-id']).toBeDefined()
    expect(StoreDelete.flags.json).toBeDefined()
    expect(StoreDelete.flags.force).toBeDefined()
  })

  test('prompts for confirmation with the store domain before deleting', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345'])

    expect(renderDangerousConfirmationPrompt).toHaveBeenCalledWith({
      message: `Delete development store my-store.myshopify.com? This can't be undone.`,
      confirmation: 'my-store.myshopify.com',
    })
    expect(deleteDevStore).toHaveBeenCalled()
  })

  test('aborts without deleting when the confirmation prompt is declined', async () => {
    vi.mocked(renderDangerousConfirmationPrompt).mockResolvedValue(false)

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345'])).rejects.toThrow()
    expect(deleteDevStore).not.toHaveBeenCalled()
  })

  test('skips the confirmation prompt when --force is passed', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--force'])

    expect(renderDangerousConfirmationPrompt).not.toHaveBeenCalled()
    expect(deleteDevStore).toHaveBeenCalled()
  })

  test('requires --force when the terminal is not interactive', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345'])).rejects.toThrow()
    expect(renderDangerousConfirmationPrompt).not.toHaveBeenCalled()
    expect(resolveOrganizationForStore).not.toHaveBeenCalled()
    expect(deleteDevStore).not.toHaveBeenCalled()
  })

  test('deletes without prompting when the terminal is not interactive and --force is passed', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--force'])

    expect(renderDangerousConfirmationPrompt).not.toHaveBeenCalled()
    expect(deleteDevStore).toHaveBeenCalled()
  })

  test('outputs structured JSON error when --json is active and --force is missing in a non-interactive run', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(
      StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--json']),
    ).rejects.toThrow('process.exit')

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    const parsed = JSON.parse(call)
    expect(parsed).toEqual({
      error: true,
      message: 'Deleting the development store my-store.myshopify.com requires confirmation.',
      nextSteps: ['Use the `--force` flag to skip confirmation when running non-interactively.'],
      exitCode: 1,
    })
    expect(deleteDevStore).not.toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  test('outputs structured JSON error when --json is active and service throws AbortError', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(
      StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--json']),
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

  test('outputs structured JSON error when --json is active and organization resolution throws AbortError', async () => {
    vi.mocked(resolveOrganizationForStore).mockRejectedValueOnce(new AbortError('Could not resolve organization'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--json'])).rejects.toThrow('process.exit')

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    const parsed = JSON.parse(call)
    expect(parsed).toEqual({
      error: true,
      message: 'Could not resolve organization',
      nextSteps: [],
      exitCode: 1,
    })
    expect(deleteDevStore).not.toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  test('does not output JSON for non-AbortError even when --json is active', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new Error('unexpected'))

    await expect(
      StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--json']),
    ).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })

  test('does not output JSON for AbortError when --json is not active', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization-id', '12345'])).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })
})
