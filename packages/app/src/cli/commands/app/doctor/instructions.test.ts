import DoctorInstructions from './instructions.js'
import {appFlags} from '../../../flags.js'
import {
  generateAppDoctorInstructions,
  writeAppDoctorInstructionsResult,
} from '../../../services/app-doctor-instructions.js'
import {appDoctorInstructionsJsonOutputSchema} from '../../../services/app-doctor-instructions-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorInstructionsResult} from '../../../services/app-doctor-instructions-json.js'

vi.mock('../../../services/app-doctor-instructions.js')
vi.mock('@shopify/cli-kit/node/context/local')

const result: AppDoctorInstructionsResult = {
  schema_version: 1,
  configuration: {identity: 'identity', path: '/app/shopify.app.toml', name: 'shopify.app.toml'},
  app_root: '/app',
  scopes: [],
  checks: [],
  instructions: '# instructions',
}

function arrange(interactive: boolean) {
  vi.mocked(isTerminalInteractive).mockReturnValue(interactive)
  vi.mocked(generateAppDoctorInstructions).mockResolvedValue(result)
}

describe('app doctor instructions command', () => {
  test('is hidden, exposes the JSON contract, and does not require linked app context', () => {
    expect(DoctorInstructions.hidden).toBe(true)
    expect(DoctorInstructions.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorInstructions.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorInstructions.flags.path).toBe(appFlags.path)
    expect(DoctorInstructions.flags.config).toBe(appFlags.config)
    expect(DoctorInstructions.flags['client-id']).toBe(appFlags['client-id'])
    expect(DoctorInstructions.flags.json).toBeDefined()
    expect(DoctorInstructions.jsonOutputSchema).toBe(appDoctorInstructionsJsonOutputSchema)
    expect(DoctorInstructions.args).not.toHaveProperty('directory')
  })

  test('generates text instructions for the current directory by default', async () => {
    arrange(true)

    await DoctorInstructions.run([], import.meta.url)

    const options = {
      directory: cwd(),
      configName: undefined,
      clientId: undefined,
      reviewDirectories: undefined,
      interactive: true,
      format: 'text',
      copy: false,
      writePath: undefined,
    }
    expect(generateAppDoctorInstructions).toHaveBeenCalledWith(options)
    expect(writeAppDoctorInstructionsResult).toHaveBeenCalledWith(result, options)
  })

  test('forwards --path, --config, repeated --review, and --copy', async () => {
    arrange(false)

    await DoctorInstructions.run(
      [
        '--path',
        './fixtures/unlinked-app',
        '--config',
        'staging',
        '--review',
        'web',
        '--review',
        './extensions',
        '--copy',
      ],
      import.meta.url,
    )

    expect(generateAppDoctorInstructions).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: resolvePath('./fixtures/unlinked-app'),
        configName: 'staging',
        reviewDirectories: [resolvePath('web'), resolvePath('./extensions')],
        interactive: false,
        format: 'text',
        copy: true,
      }),
    )
  })

  test('selects the json format and resolves --write', async () => {
    arrange(true)

    await DoctorInstructions.run(['--json'], import.meta.url)
    expect(writeAppDoctorInstructionsResult).toHaveBeenCalledWith(result, expect.objectContaining({format: 'json'}))

    await DoctorInstructions.run(['--write', './instructions.md'], import.meta.url)
    expect(writeAppDoctorInstructionsResult).toHaveBeenCalledWith(
      result,
      expect.objectContaining({format: 'text', writePath: resolvePath('./instructions.md')}),
    )
  })

  test('keeps --copy, --write, and --json mutually exclusive', () => {
    expect(DoctorInstructions.flags.copy.exclusive).toEqual(['write', 'json'])
    expect(DoctorInstructions.flags.write.exclusive).toEqual(['copy', 'json'])
  })
})
