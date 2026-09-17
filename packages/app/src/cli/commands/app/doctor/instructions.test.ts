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
    expect(DoctorInstructions.args).not.toHaveProperty('directory')
  })

  test('prints instructions for the current directory by default', async () => {
    await DoctorInstructions.run([], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      copy: false,
      writePath: undefined,
    })
  })

  test('forwards --path and --copy', async () => {
    await DoctorInstructions.run(['--path', './fixtures/unlinked-app', '--copy'], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      copy: true,
      writePath: undefined,
    })
  })

  test('resolves and forwards --write', async () => {
    await DoctorInstructions.run(['--write', './instructions.md'], import.meta.url)

    expect(deliverAppDoctorInstructions).toHaveBeenCalledWith({
      directory: cwd(),
      copy: false,
      writePath: resolvePath('./instructions.md'),
    })
  })

  test('keeps --copy and --write mutually exclusive', () => {
    expect(DoctorInstructions.flags.copy.exclusive).toEqual(['write'])
    expect(DoctorInstructions.flags.write.exclusive).toEqual(['copy'])
  })
})
