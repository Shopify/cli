import Duplicate from './duplicate.js'
import {themeDuplicateJsonOutputSchema} from '../../services/duplicate/types.js'
import {findThemeById} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeDuplicate} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../../utilities/theme-selector.js')

const originalTheme = {id: 1, name: 'Original', role: 'unpublished', processing: false, createdAtRuntime: false}
const copiedTheme = {...originalTheme, id: 2, name: 'Copy'}
const session = {token: 'token', storeFqdn: 'test.myshopify.com'}

async function run() {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  const argv = ['--store', session.storeFqdn, '--theme', '1', '--force', '--json']
  await runWithCommandEventsForCommand(argv, () => new Duplicate(argv, config).run())
}

describe('theme duplicate JSON output', () => {
  test('exposes its schema in help and keeps the JSON flag', () => {
    expect(Duplicate.jsonOutputSchema).toBe(themeDuplicateJsonOutputSchema)
    expect(Duplicate.flags.json).toBeDefined()
    expect(Duplicate.description).toContain('ThemeDuplicateResult')
  })

  test('writes the exact legacy document and routes diagnostics to stderr', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockImplementation(async () => {
      outputWarn('Retrying request')
      return {theme: copiedTheme, userErrors: [], requestId: 'omitted-on-success'}
    })

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run()
      expect(stdout()).toBe('{"theme":{"id":2,"name":"Copy","role":"unpublished","shop":"test.myshopify.com"}}\n')
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Retrying request'})
    })
  })

  test.each([undefined, '', 'request-123'])('preserves errors and request ID omission (%s)', async (requestId) => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({userErrors: [{message: 'Limit reached'}], requestId})
    const exitCode = process.exitCode

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run()
      expect(stdout()).toBe(
        `${JSON.stringify({message: "The theme 'Original' could not be duplicated due to errors", errors: ['Limit reached'], requestId})}\n`,
      )
      expect(stderr()).toBe('')
      expect(process.exitCode).toBe(exitCode)
    })
  })

  test('keeps the trailing space in unexpected failure messages', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({userErrors: []})
    await withCapturedStandardStreams(async ({stdout}) => {
      await run()
      expect(stdout()).toBe('{"message":"The theme \'Original\' unexpectedly could not be duplicated ","errors":[]}\n')
    })
  })

  test('does not write a result when the API throws', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockRejectedValue(new Error('Network failure'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run()).rejects.toThrow('Network failure')
      expect(stdout()).toBe('')
    })
  })

  test.each([
    {theme: {id: '2', name: 'Copy', role: 'unpublished', shop: session.storeFqdn}},
    {theme: {id: 2, name: null, role: 'unpublished', shop: session.storeFqdn}},
    {message: 'Failed', errors: [1]},
    {message: 'Failed', errors: [], requestId: null},
  ])('rejects malformed public results %#', (result) => {
    expect(() => themeDuplicateJsonOutputSchema.validate(result)).toThrow()
  })
})
