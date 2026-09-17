import DoctorInstructions from './instructions.js'
import {appFlags} from '../../../flags.js'
import deliverAppDoctorInstructions from '../../../services/app-doctor-instructions.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-doctor-instructions.js')

describe('app doctor instructions command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(DoctorInstructions.hidden).toBe(true)
    expect(DoctorInstructions.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorInstructions.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorInstructions.flags.path).toBe(appFlags.path)
    expect(DoctorInstructions.flags.config).toBe(appFlags.config)
    expect(DoctorInstructions.args).not.toHaveProperty('directory')
  })

  test('prints instructions for the current directory by default', async () => {
    await DoctorInstructions.run([], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      copy: false,
      writePath: undefined,
    })
  })

  test('forwards --path and --copy', async () => {
    await DoctorInstructions.run(['--path', './fixtures/unlinked-app', '--copy'], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      copy: true,
      writePath: undefined,
    })
  })

  test('resolves and forwards --write', async () => {
    await DoctorInstructions.run(['--write', './instructions.md'], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      copy: false,
      writePath: resolvePath('./instructions.md'),
    })
  })

  test('forwards --config', async () => {
    await DoctorInstructions.run(['--path', './fixtures/unlinked-app', '--config', 'staging'], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith(expect.objectContaining({configName: 'staging'}))
  })

  test('keeps --copy and --write mutually exclusive', () => {
    expect(DoctorInstructions.flags.copy.exclusive).toEqual(['write'])
    expect(DoctorInstructions.flags.write.exclusive).toEqual(['copy'])
  })
})
