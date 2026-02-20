import {registerAuthLogin} from './auth-login.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import type {McpServerConfig} from '../config.js'

interface ToolResult {
  content: {type: string; text: string}[]
  isError?: boolean
}

const mockExecShopify = vi.fn()
const mockFormatToolResult = vi.fn()

vi.mock('../subprocess.js', () => ({
  execShopify: (...args: unknown[]) => mockExecShopify(...args),
  formatToolResult: (...args: unknown[]) => mockFormatToolResult(...args),
}))

describe('shopify_auth_login', () => {
  const config: McpServerConfig = {
    shopifyCliPath: 'shopify',
    store: 'default-store.myshopify.com',
    timeout: 120_000,
  }

  let handler: (params: {[key: string]: unknown}) => Promise<ToolResult>

  beforeEach(() => {
    const mockServer = {registerTool: vi.fn()} as any
    registerAuthLogin(mockServer, config)
    handler = mockServer.registerTool.mock.calls[0]![2]!
    mockExecShopify.mockResolvedValue({stdout: 'Logged in', stderr: '', exitCode: 0})
    mockFormatToolResult.mockReturnValue({content: [{type: 'text', text: 'ok'}]})
  })

  test('registers with correct tool name', () => {
    const mockServer = {registerTool: vi.fn()} as any
    registerAuthLogin(mockServer, config)
    expect(mockServer.registerTool.mock.calls[0]![0]).toBe('shopify_auth_login')
  })

  test('passes auth login args with explicit store', async () => {
    // When
    await handler({store: 'my-store.myshopify.com'})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['auth', 'login', '--store', 'my-store.myshopify.com'], {
      timeout: 120_000,
    })
  })

  test('falls back to config store', async () => {
    // When
    await handler({})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['auth', 'login', '--store', 'default-store.myshopify.com'], {
      timeout: 120_000,
    })
  })

  test('omits --store when no store configured', async () => {
    // Given
    const noStoreConfig: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}
    const mockServer = {registerTool: vi.fn()} as any
    registerAuthLogin(mockServer, noStoreConfig)
    const noStoreHandler: (params: {[key: string]: unknown}) => Promise<ToolResult> = mockServer.registerTool.mock.calls[0]![2]

    // When
    await noStoreHandler({})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(noStoreConfig, ['auth', 'login'], {timeout: 120_000})
  })
})
