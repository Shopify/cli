import SecurityInstructions from './instructions.js'
import {appFlags} from '../../../flags.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import deliverAppSecurityInstructions from '../../../services/app-security-instructions.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-security-instructions.js')
vi.mock('../../../services/app-security-selection.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-selection.js')>()),
  resolveAppSecuritySelection: vi.fn(),
}))

describe('app security instructions command', () => {
  beforeEach(() => {
    vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
      kind: 'config',
      appDirectory: '/tmp/app',
      appConfigFilePath: '/tmp/app/shopify.app.toml',
    })
  })

  test('is hidden and does not require linked app context', () => {
    expect(SecurityInstructions.hidden).toBe(true)
    expect(SecurityInstructions.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityInstructions.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityInstructions.flags.path).toBe(appFlags.path)
    expect(SecurityInstructions.flags.config).toBe(appFlags.config)
    expect(SecurityInstructions.args).not.toHaveProperty('directory')
  })

  test('prints instructions for the current directory by default', async () => {
    await SecurityInstructions.run([], import.meta.url)

    expect(resolveAppSecuritySelection).toHaveBeenCalledWith({path: cwd(), config: undefined, allowPrompts: false})
    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith({
      appDirectory: '/tmp/app',
      commands: resolveAppSecurityCommands('/tmp/app', 'shopify.app.toml'),
      copy: false,
      writePath: undefined,
    })
  })

  test('forwards --path and --copy', async () => {
    await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--copy'], import.meta.url)

    expect(resolveAppSecuritySelection).toHaveBeenCalledWith(
      expect.objectContaining({path: resolvePath('./fixtures/unlinked-app')}),
    )
    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(expect.objectContaining({copy: true}))
  })

  test('resolves and forwards --write', async () => {
    await SecurityInstructions.run(['--write', './instructions.md'], import.meta.url)

    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
      expect.objectContaining({copy: false, writePath: resolvePath('./instructions.md')}),
    )
  })

  test('selects the configuration named by --config and puts it in the commands', async () => {
    vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
      kind: 'config',
      appDirectory: '/tmp/app',
      appConfigFilePath: '/tmp/app/shopify.app.staging.toml',
    })

    await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--config', 'staging'], import.meta.url)

    expect(resolveAppSecuritySelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
      expect.objectContaining({commands: resolveAppSecurityCommands('/tmp/app', 'shopify.app.staging.toml')}),
    )
  })

  test('keeps --copy and --write mutually exclusive', () => {
    expect(SecurityInstructions.flags.copy.exclusive).toEqual(['write'])
    expect(SecurityInstructions.flags.write.exclusive).toEqual(['copy'])
  })
})
