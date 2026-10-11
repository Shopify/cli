import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../services/store/execute/index.js')
vi.mock('../../services/store/attribution.js')

describe('API version deprecation output', () => {
  beforeEach(() => {
    vi.stubEnv('SHOPIFY_FLAG_API_VERSION', '')
    vi.stubEnv('SHOPIFY_FLAG_VERSION', '')
    vi.stubEnv('SHOPIFY_UNIT_TEST', 'false')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test.each([
    {args: ['--api-version', '2025-10'], legacyEnv: false, warning: false},
    {args: ['--version', '2025-10'], legacyEnv: false, warning: true},
    {args: ['--version=2025-10'], legacyEnv: false, warning: true},
    {args: [], legacyEnv: true, warning: true},
  ])(
    'keeps stdout and stderr structured in JSON mode: $args, legacy env: $legacyEnv',
    async ({args, legacyEnv, warning}) => {
      if (legacyEnv) vi.stubEnv('SHOPIFY_FLAG_VERSION', '2025-10')
      const stdout: string[] = []
      const stderr: string[] = []
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        stdout.push(String(chunk))
        return true
      })
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderr.push(String(chunk))
        return true
      })
      const realConsole = new Console(process.stdout, process.stderr)
      const logSpy = vi.spyOn(console, 'log').mockImplementation(realConsole.log)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(realConsole.warn)
      try {
        const {default: StoreExecute} = await import('./execute.js')
        const {executeStoreOperation} = await import('../../services/store/execute/index.js')
        vi.mocked(executeStoreOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
        await StoreExecute.run([
          '--store',
          'shop.myshopify.com',
          '--query',
          '{ shop { name } }',
          '--json',
          '--no-input',
          ...args,
        ])

        expect(JSON.parse(stdout.join(''))).toEqual({data: {shop: {name: 'Test shop'}}})
        expect(executeStoreOperation).toHaveBeenCalledWith(expect.objectContaining({version: '2025-10'}))
        const events = stderr
          .join('')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
        if (warning) {
          expect(events).toContainEqual(expect.objectContaining({type: 'diagnostic', level: 'warning'}))
          expect(events.filter((event) => event.level === 'warning')).toHaveLength(1)
        } else {
          expect(events).toEqual([])
        }
      } finally {
        stdoutSpy.mockRestore()
        stderrSpy.mockRestore()
        logSpy.mockRestore()
        warnSpy.mockRestore()
      }
    },
  )
})
