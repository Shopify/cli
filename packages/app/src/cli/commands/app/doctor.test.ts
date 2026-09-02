import Doctor from './doctor.js'
import {appFlags} from '../../flags.js'
import doctor from '../../services/doctor.js'
import AppLinkedCommand from '../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/doctor.js')

describe('app doctor command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(Doctor.hidden).toBe(true)
    expect(Doctor.prototype).toBeInstanceOf(BaseCommand)
    expect(Doctor.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(Doctor.flags.path).toBe(appFlags.path)
    expect(Doctor.args).not.toHaveProperty('directory')
  })

  test('forwards --path and flags to the service', async () => {
    await Doctor.run(
      ['--path', './fixtures/unlinked-app', '--json', '--verbose', '--blocking', 'high', '--skip-instructions'],
      import.meta.url,
    )

    expect(doctor).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      json: true,
      verbose: true,
      blocking: 'high',
      yes: false,
      skipInstructions: true,
      findingsPath: undefined,
    })
  })

  test('forwards --yes without requiring an app configuration', async () => {
    await Doctor.run(['--path', '/tmp/directory-without-shopify-toml', '--yes'], import.meta.url)

    expect(doctor).toHaveBeenCalledWith({
      directory: '/tmp/directory-without-shopify-toml',
      json: false,
      verbose: false,
      blocking: 'none',
      yes: true,
      skipInstructions: false,
      findingsPath: undefined,
    })
  })

  test('resolves and forwards an agent findings file', async () => {
    await Doctor.run(['--findings', './findings.json', '--skip-instructions'], import.meta.url)

    expect(doctor).toHaveBeenCalledWith(expect.objectContaining({findingsPath: resolvePath('./findings.json')}))
  })

  test('describes --yes as printing instructions and keeps it mutually exclusive with --skip-instructions', () => {
    expect(Doctor.flags.yes.description).toBe('Print coding-agent instructions without prompting.')
    expect(Doctor.flags['skip-instructions'].description).toBe("Don't offer to show coding-agent instructions.")
    expect(Doctor.flags.yes.exclusive).toEqual(['skip-instructions'])
    expect(Doctor.flags['skip-instructions'].exclusive).toEqual(['yes'])
    expect(Doctor.descriptionWithMarkdown).toContain('copy the coding-agent instructions')
    expect(Doctor.descriptionWithMarkdown).toContain('copying is the default')
    expect(Doctor.descriptionWithMarkdown).toContain('shopify app doctor instructions')
    expect(Doctor.descriptionWithMarkdown).toContain('npm audit')
    expect(Doctor.descriptionWithMarkdown).toContain('https://registry.npmjs.org/')
  })

  test('allows --yes in JSON mode while preserving non-interactive output behavior', async () => {
    await Doctor.run(['--json', '--yes'], import.meta.url)

    expect(doctor).toHaveBeenCalledWith(expect.objectContaining({json: true, yes: true}))
  })
})
