import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import securityCheck from '../../../services/security-check.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-check.js')

describe('app security check command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityCheck.hidden).toBe(true)
    expect(SecurityCheck.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityCheck.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityCheck.flags.path).toBe(appFlags.path)
    expect(SecurityCheck.flags.config).toBe(appFlags.config)
    expect(SecurityCheck.args).not.toHaveProperty('directory')
  })

  test('forwards --path and flags to the service', async () => {
    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--json', '--verbose', '--blocking', 'high', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      json: true,
      verbose: true,
      blocking: 'high',
      yes: false,
      skipInstructions: true,
      findingsPath: undefined,
      clean: false,
    })
  })

  test('forwards --yes without requiring an app configuration', async () => {
    await SecurityCheck.run(['--path', '/tmp/directory-without-shopify-toml', '--yes'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith({
      directory: '/tmp/directory-without-shopify-toml',
      configName: undefined,
      json: false,
      verbose: false,
      blocking: 'none',
      yes: true,
      skipInstructions: false,
      findingsPath: undefined,
      clean: false,
    })
  })

  test('forwards --config without requiring a linked app', async () => {
    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--config', 'staging', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({configName: 'staging', skipInstructions: true}))
  })

  test('forwards --clean and keeps it mutually exclusive with --findings', async () => {
    await SecurityCheck.run(['--clean', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({clean: true, findingsPath: undefined}))
    expect(SecurityCheck.flags.clean.exclusive).toEqual(['findings'])
  })

  test.each(['true', 'false'])(
    'ignores an inherited SHOPIFY_FLAG_APP_SECURITY_CLEAN=%s so a plain scan stays non-destructive',
    async (inheritedValue) => {
      vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_CLEAN', inheritedValue)
      try {
        expect(SecurityCheck.flags.clean).not.toHaveProperty('env')

        await SecurityCheck.run(['--skip-instructions'], import.meta.url)
        expect(securityCheck).toHaveBeenLastCalledWith(expect.objectContaining({clean: false}))

        await SecurityCheck.run(['--findings', './findings.json', '--skip-instructions'], import.meta.url)
        expect(securityCheck).toHaveBeenLastCalledWith(
          expect.objectContaining({clean: false, findingsPath: resolvePath('./findings.json')}),
        )
      } finally {
        vi.unstubAllEnvs()
      }
    },
  )

  test('resolves and forwards an agent findings file', async () => {
    await SecurityCheck.run(['--findings', './findings.json', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({findingsPath: resolvePath('./findings.json')}))
  })

  test('describes --yes as printing instructions and keeps it mutually exclusive with --skip-instructions', () => {
    expect(SecurityCheck.flags.yes.description).toBe('Print coding-agent instructions without prompting.')
    expect(SecurityCheck.flags['skip-instructions'].description).toBe("Don't offer to show coding-agent instructions.")
    expect(SecurityCheck.flags.clean.description).toBe('Discard the current local review and start a new scan.')
    expect(SecurityCheck.flags.yes.exclusive).toEqual(['skip-instructions'])
    expect(SecurityCheck.flags['skip-instructions'].exclusive).toEqual(['yes'])
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copy the coding-agent instructions')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--config`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copying is the default')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('shopify app security instructions')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('Pass `--clean` to discard that work and start over')
  })

  test('allows --yes in JSON mode while preserving non-interactive output behavior', async () => {
    await SecurityCheck.run(['--json', '--yes'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({json: true, yes: true}))
  })
})
