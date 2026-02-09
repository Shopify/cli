import {buildEnv, isAuthError, formatToolResult, execShopify, isLongRunningCommand} from './subprocess.js'
import {describe, expect, test, vi} from 'vitest'
import type {McpServerConfig} from './config.js'
import type {ExecResult} from './subprocess.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('execShopify', () => {
  test('calls execa with args plus --no-color appended', async () => {
    // Given
    const {execa: mockExeca} = await import('execa')
    vi.mocked(mockExeca).mockResolvedValue({
      stdout: '{}',
      stderr: '',
      exitCode: 0,
    } as any)

    const config: McpServerConfig = {
      shopifyCliPath: '/usr/local/bin/shopify',
      store: 'my-store.myshopify.com',
      themeAccessPassword: 'token123',
      timeout: 60000,
    }

    // When
    await execShopify(config, ['theme', 'list', '--json'])

    // Then
    expect(mockExeca).toHaveBeenCalledWith(
      '/usr/local/bin/shopify',
      ['theme', 'list', '--json', '--no-color'],
      expect.objectContaining({
        reject: false,
        timeout: 60000,
        env: {
          NO_COLOR: '1',
          SHOPIFY_FLAG_STORE: 'my-store.myshopify.com',
          SHOPIFY_CLI_THEME_TOKEN: 'token123',
        },
      }),
    )
  })

  test('uses option timeout over config timeout', async () => {
    // Given
    const {execa: mockExeca} = await import('execa')
    vi.mocked(mockExeca).mockResolvedValue({stdout: '', stderr: '', exitCode: 0} as any)
    const config: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}

    // When
    await execShopify(config, ['auth', 'login'], {timeout: 300_000})

    // Then
    expect(mockExeca).toHaveBeenCalledWith('shopify', expect.any(Array), expect.objectContaining({timeout: 300_000}))
  })

  test('returns friendly error when CLI binary is not found', async () => {
    // Given
    const {execa: mockExeca} = await import('execa')
    const enoent = new Error('spawn shopify ENOENT') as Error & {code: string}
    enoent.code = 'ENOENT'
    vi.mocked(mockExeca).mockRejectedValue(enoent)
    const config: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}

    // When
    const result = await execShopify(config, ['theme', 'list'])

    // Then
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Shopify CLI not found')
    expect(result.stderr).toContain('npm install -g @shopify/cli')
  })

  test('returns stdout, stderr, and exitCode', async () => {
    // Given
    const {execa: mockExeca} = await import('execa')
    vi.mocked(mockExeca).mockResolvedValue({
      stdout: 'output',
      stderr: 'warning',
      exitCode: 1,
    } as any)
    const config: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}

    // When
    const result = await execShopify(config, ['theme', 'push'])

    // Then
    expect(result).toEqual({stdout: 'output', stderr: 'warning', exitCode: 1})
  })
})

describe('isLongRunningCommand', () => {
  test('detects "theme dev" as long-running', () => {
    expect(isLongRunningCommand(['theme', 'dev'])).toBe('theme dev')
    expect(isLongRunningCommand(['theme', 'dev', '--store', 'x'])).toBe('theme dev')
  })

  test('detects "app dev" as long-running', () => {
    expect(isLongRunningCommand(['app', 'dev'])).toBe('app dev')
  })

  test('returns undefined for normal commands', () => {
    expect(isLongRunningCommand(['theme', 'list'])).toBeUndefined()
    expect(isLongRunningCommand(['theme', 'push'])).toBeUndefined()
    expect(isLongRunningCommand(['app', 'deploy'])).toBeUndefined()
  })
})

describe('buildEnv', () => {
  test('always sets NO_COLOR', () => {
    const config: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}
    expect(buildEnv(config)).toEqual({NO_COLOR: '1'})
  })

  test('sets SHOPIFY_FLAG_STORE when store is configured', () => {
    const config: McpServerConfig = {shopifyCliPath: 'shopify', store: 'my-store.myshopify.com', timeout: 120_000}
    expect(buildEnv(config).SHOPIFY_FLAG_STORE).toBe('my-store.myshopify.com')
  })

  test('sets SHOPIFY_CLI_THEME_TOKEN when themeAccessPassword is configured', () => {
    const config: McpServerConfig = {shopifyCliPath: 'shopify', themeAccessPassword: 'tok', timeout: 120_000}
    expect(buildEnv(config).SHOPIFY_CLI_THEME_TOKEN).toBe('tok')
  })

  test('sets SHOPIFY_FLAG_PATH when path is configured', () => {
    const config: McpServerConfig = {shopifyCliPath: 'shopify', path: '/themes/dawn', timeout: 120_000}
    expect(buildEnv(config).SHOPIFY_FLAG_PATH).toBe('/themes/dawn')
  })

  test('sets all env vars when fully configured', () => {
    const config: McpServerConfig = {
      shopifyCliPath: 'shopify',
      store: 'store',
      themeAccessPassword: 'pw',
      path: '/p',
      timeout: 120_000,
    }
    const env = buildEnv(config)
    expect(env).toEqual({
      NO_COLOR: '1',
      SHOPIFY_FLAG_STORE: 'store',
      SHOPIFY_CLI_THEME_TOKEN: 'pw',
      SHOPIFY_FLAG_PATH: '/p',
    })
  })
})

describe('isAuthError', () => {
  test.each([
    'You are not logged in',
    'Authentication required',
    'Run shopify auth login first',
    'Your session has expired',
    'Invalid credentials provided',
    'Please login to continue',
    'Not authenticated',
  ])('detects "%s" as auth error', (message) => {
    expect(isAuthError(message)).toBe(true)
  })

  test('returns false for non-auth errors', () => {
    expect(isAuthError('Theme not found')).toBe(false)
    expect(isAuthError('')).toBe(false)
  })
})

describe('formatToolResult', () => {
  test('returns auth error when exit code is non-zero and output matches auth pattern', () => {
    const result: ExecResult = {stdout: '', stderr: 'You are not logged in', exitCode: 1}
    const formatted = formatToolResult(result)
    expect(formatted.isError).toBe(true)
    expect(formatted.content[0]!.text).toContain('shopify_auth_login')
  })

  test('returns generic error when exit code is non-zero', () => {
    const result: ExecResult = {stdout: '', stderr: 'Theme not found', exitCode: 1}
    const formatted = formatToolResult(result)
    expect(formatted.isError).toBe(true)
    expect(formatted.content[0]!.text).toBe('Theme not found')
  })

  test('returns exit code message when both stdout and stderr are empty', () => {
    const result: ExecResult = {stdout: '', stderr: '', exitCode: 2}
    const formatted = formatToolResult(result)
    expect(formatted.isError).toBe(true)
    expect(formatted.content[0]!.text).toContain('exit code 2')
  })

  test('returns success message when stdout is empty', () => {
    const result: ExecResult = {stdout: '', stderr: '', exitCode: 0}
    expect(formatToolResult(result).content[0]!.text).toBe('Command completed successfully.')
  })

  test('auto-detects and pretty-prints JSON objects', () => {
    const result: ExecResult = {stdout: '{"id":1,"name":"Dawn"}', stderr: '', exitCode: 0}
    const formatted = formatToolResult(result)
    expect(formatted.content[0]!.text).toBe('{\n  "id": 1,\n  "name": "Dawn"\n}')
  })

  test('auto-detects and pretty-prints JSON arrays', () => {
    const result: ExecResult = {stdout: '[{"id":1}]', stderr: '', exitCode: 0}
    const formatted = formatToolResult(result)
    expect(formatted.content[0]!.text).toContain('[\n')
  })

  test('returns raw text when output starts with { but is not valid JSON', () => {
    const result: ExecResult = {stdout: '{not json', stderr: '', exitCode: 0}
    expect(formatToolResult(result).content[0]!.text).toBe('{not json')
  })

  test('returns raw text for non-JSON output', () => {
    const result: ExecResult = {stdout: 'Theme pushed successfully', stderr: '', exitCode: 0}
    expect(formatToolResult(result).content[0]!.text).toBe('Theme pushed successfully')
  })

  test('trims whitespace from output', () => {
    const result: ExecResult = {stdout: '  hello  \n', stderr: '', exitCode: 0}
    expect(formatToolResult(result).content[0]!.text).toBe('hello')
  })
})
