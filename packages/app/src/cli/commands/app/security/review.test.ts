import SecurityReview from './review.js'
import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import securityReview from '../../../services/security-review.js'
import {renderSecurityReviewResult} from '../../../services/security-review/result.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-review.js')
vi.mock('../../../services/security-review/result.js')

describe('app security review command', () => {
  test('documents command-specific telemetry and links to usage reporting', () => {
    expect(SecurityReview.descriptionWithMarkdown).toContain(
      'Reports the number of findings to Shopify as usage telemetry, but not finding details.',
    )
    expect(SecurityReview.descriptionWithMarkdown).toContain(
      '[usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting)',
    )
    expect(SecurityReview.descriptionWithMarkdown).not.toContain('SHOPIFY_CLI_NO_ANALYTICS=1')
    expect(SecurityReview.description).toContain('https://shopify.dev/docs/api/shopify-cli#usage-reporting')
  })

  test('does not require linked app context', () => {
    expect(SecurityReview.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityReview.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityReview.flags).not.toHaveProperty('json')
    expect(SecurityReview.jsonOutputSchema).toBeUndefined()
  })

  test('defines the selection flags as check does', () => {
    expect(SecurityReview.flags.path).toBe(appFlags.path)
    expect(SecurityReview.flags.config).toBe(appFlags.config)
    expect(SecurityReview.flags['client-id']).toBe(appFlags['client-id'])
    expect(SecurityReview.flags['without-app-config']).toBe(SecurityCheck.flags['without-app-config'])
  })

  test('shares the --blocking flag with check', () => {
    expect(SecurityReview.flags.blocking).toBe(SecurityCheck.flags.blocking)
    expect(SecurityReview.flags.blocking.options).toEqual(['high', 'medium', 'low', 'none'])
    expect(SecurityReview.flags.blocking.env).toBe('SHOPIFY_FLAG_APP_SECURITY_BLOCKING')
  })

  test('reads --check-id repeatedly and from SHOPIFY_FLAG_CHECK_ID', () => {
    expect(SecurityReview.flags['check-id'].multiple).toBe(true)
    expect(SecurityReview.flags['check-id'].env).toBe('SHOPIFY_FLAG_CHECK_ID')
  })

  test('reviews the current directory by default with no filter and no blocking', async () => {
    await SecurityReview.run([], import.meta.url)

    expect(securityReview).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      checkIds: [],
      blocking: 'none',
    })
  })

  test.each([
    ['without --verbose', [], false],
    ['with --verbose', ['--verbose'], true],
  ])('presents the reviewed results %s', async (_description, argv, verbose) => {
    const review = {} as Awaited<ReturnType<typeof securityReview>>
    vi.mocked(securityReview).mockResolvedValue(review)

    await SecurityReview.run(argv, import.meta.url)

    expect(renderSecurityReviewResult).toHaveBeenCalledWith(review, {verbose})
  })

  test('forwards --path, --config, --client-id and --without-app-config', async () => {
    await SecurityReview.run(
      ['--path', './fixtures/app', '--without-app-config', '--client-id', 'abc123'],
      import.meta.url,
    )

    expect(securityReview).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: resolvePath('./fixtures/app'),
        clientId: 'abc123',
        withoutAppConfig: true,
      }),
    )

    await SecurityReview.run(['--path', './fixtures/app', '--config', 'staging'], import.meta.url)

    expect(securityReview).toHaveBeenLastCalledWith(expect.objectContaining({configName: 'staging'}))
  })

  test('forwards --path, every --check-id and --blocking', async () => {
    await SecurityReview.run(
      [
        '--path',
        './fixtures/app',
        '--verbose',
        '--check-id',
        'OPEN_REDIRECT',
        '--check-id',
        'EOL_API_VERSION',
        '--blocking',
        'medium',
      ],
      import.meta.url,
    )

    expect(securityReview).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/app'),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      checkIds: ['OPEN_REDIRECT', 'EOL_API_VERSION'],
      blocking: 'medium',
    })
  })
})
