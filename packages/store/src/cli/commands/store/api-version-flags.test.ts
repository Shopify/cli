import Execute from './execute.js'
import BulkExecute from './bulk/execute.js'
import GraphiQL from './graphiql.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Command, Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderWarning: vi.fn(),
}))

class ParseExecute extends Execute {
  public parseFlags() {
    return this.parse(Execute)
  }
}

class ParseBulkExecute extends BulkExecute {
  public parseFlags() {
    return this.parse(BulkExecute)
  }
}

class ParseGraphiQL extends GraphiQL {
  public parseFlags() {
    return this.parse(GraphiQL)
  }
}

describe.each([
  {
    name: 'store execute',
    parse: async (argv: string[]) => new ParseExecute(argv, await Config.load({root: __dirname})).parseFlags(),
  },
  {
    name: 'store bulk execute',
    parse: async (argv: string[]) => new ParseBulkExecute(argv, await Config.load({root: __dirname})).parseFlags(),
  },
  {
    name: 'store graphiql',
    parse: async (argv: string[]) => new ParseGraphiQL(argv, await Config.load({root: __dirname})).parseFlags(),
  },
])('$name API version flags', ({name, parse}) => {
  const requiredArgs = name.endsWith('graphiql') ? [] : ['--query', '{ shop { name } }']
  const argv = ['--store', 'shop.myshopify.com', ...requiredArgs]

  beforeEach(() => {
    vi.stubEnv('SHOPIFY_FLAG_API_VERSION', '')
    vi.stubEnv('SHOPIFY_FLAG_VERSION', '')
    vi.spyOn(Command.prototype, 'warn').mockImplementation(() => '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('parses --api-version without a deprecation warning', async () => {
    const {flags} = await parse([...argv, '--api-version', '2026-01'])
    expect(flags['api-version']).toBe('2026-01')
    expect(Command.prototype.warn).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('keeps --version as an alias and warns', async () => {
    const {flags} = await parse([...argv, '--version', '2025-10'])
    expect(flags['api-version']).toBe('2025-10')
    expect(Command.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('--api-version'))
  })

  test.each([
    ['--version', '2025-10', '--api-version', '2026-01'],
    ['--api-version', '2026-01', '--version', '2025-10'],
  ])('rejects both flag names rather than choosing an API version: %s', async (...args) => {
    await expect(parse([...argv, ...args])).rejects.toThrow('Flag --api-version can only be specified once')
  })

  test('reads SHOPIFY_FLAG_API_VERSION', async () => {
    vi.stubEnv('SHOPIFY_FLAG_API_VERSION', '2026-01')
    const {flags} = await parse(argv)
    expect(flags['api-version']).toBe('2026-01')
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('keeps SHOPIFY_FLAG_VERSION working and warns', async () => {
    vi.stubEnv('SHOPIFY_FLAG_VERSION', '2025-10')
    const {flags} = await parse(argv)
    expect(flags['api-version']).toBe('2025-10')
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'SHOPIFY_FLAG_VERSION is deprecated for API versions.',
      }),
    )
  })

  test('prefers the new environment variable when both are set', async () => {
    vi.stubEnv('SHOPIFY_FLAG_API_VERSION', '2026-01')
    vi.stubEnv('SHOPIFY_FLAG_VERSION', '2025-10')
    const {flags} = await parse(argv)
    expect(flags['api-version']).toBe('2026-01')
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test.each(['--api-version', '--version'])('prefers %s to either environment variable', async (flag) => {
    vi.stubEnv('SHOPIFY_FLAG_API_VERSION', '2025-07')
    vi.stubEnv('SHOPIFY_FLAG_VERSION', '2025-10')
    const {flags} = await parse([...argv, flag, '2026-01'])
    expect(flags['api-version']).toBe('2026-01')
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('leaves the API version unset when no flag or environment variable is given', async () => {
    const {flags} = await parse(argv)
    expect(flags['api-version']).toBeUndefined()
    expect(renderWarning).not.toHaveBeenCalled()
  })
})
