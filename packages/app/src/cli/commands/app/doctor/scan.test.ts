import DoctorScan from './scan.js'
import doctor from '../../../services/doctor.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/doctor.js')

describe('app doctor scan command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(DoctorScan.hidden).toBe(true)
    expect(DoctorScan.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorScan.prototype).not.toBeInstanceOf(AppLinkedCommand)
  })

  test('forwards the directory and flags to the service', async () => {
    await DoctorScan.run(
      ['./fixtures/unlinked-app', '--json', '--verbose', '--blocking', 'high', '--skip-instructions'],
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
    await DoctorScan.run(['/tmp/directory-without-shopify-toml', '--yes'], import.meta.url)

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
    await DoctorScan.run(['.', '--findings', './findings.json', '--skip-instructions'], import.meta.url)

    expect(doctor).toHaveBeenCalledWith(expect.objectContaining({findingsPath: resolvePath('./findings.json')}))
  })

  test('describes --yes as showing instructions and keeps it mutually exclusive with --skip-instructions', () => {
    expect(DoctorScan.flags.yes.description).toBe('Show coding-agent instructions without prompting.')
    expect(DoctorScan.flags['skip-instructions'].description).toBe("Don't offer to show coding-agent instructions.")
    expect(DoctorScan.flags.yes.exclusive).toEqual(['skip-instructions'])
    expect(DoctorScan.flags['skip-instructions'].exclusive).toEqual(['yes'])
    expect(DoctorScan.descriptionWithMarkdown).toContain('shopify app doctor instructions')
  })

  test('allows --yes in JSON mode while preserving non-interactive output behavior', async () => {
    await DoctorScan.run(['--json', '--yes'], import.meta.url)

    expect(doctor).toHaveBeenCalledWith(expect.objectContaining({json: true, yes: true}))
  })
})
