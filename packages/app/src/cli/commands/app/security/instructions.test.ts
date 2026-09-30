import SecurityInstructions from './instructions.js'
import {appFlags} from '../../../flags.js'
import deliverAppSecurityInstructions from '../../../services/app-security-instructions.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-security-instructions.js')

describe('app security instructions command', () => {
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

    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      copy: false,
      writePath: undefined,
    })
  })

  test('forwards --path and --copy', async () => {
    await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--copy'], import.meta.url)

    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      copy: true,
      writePath: undefined,
    })
  })

  test('resolves and forwards --write', async () => {
    await SecurityInstructions.run(['--write', './instructions.md'], import.meta.url)

    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      copy: false,
      writePath: resolvePath('./instructions.md'),
    })
  })

  test('forwards --config', async () => {
    await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--config', 'staging'], import.meta.url)

    expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(expect.objectContaining({configName: 'staging'}))
  })

  test('keeps --copy and --write mutually exclusive', () => {
    expect(SecurityInstructions.flags.copy.exclusive).toEqual(['write'])
    expect(SecurityInstructions.flags.write.exclusive).toEqual(['copy'])
  })
})
