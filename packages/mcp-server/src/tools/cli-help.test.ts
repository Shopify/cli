import {registerCliHelp} from './cli-help.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import type {McpServerConfig} from '../config.js'

interface ToolResult {
  content: {type: string; text: string}[]
  isError?: boolean
}

const mockExecShopify = vi.fn()

vi.mock('../subprocess.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../subprocess.js')>()
  return {
    ...actual,
    execShopify: (...args: unknown[]) => mockExecShopify(...args),
  }
})

describe('shopify_cli_help', () => {
  const config: McpServerConfig = {shopifyCliPath: 'shopify', timeout: 120_000}
  let handler: (params: {[key: string]: unknown}) => Promise<ToolResult>

  beforeEach(() => {
    const mockServer = {registerTool: vi.fn()} as any
    registerCliHelp(mockServer, config)
    handler = mockServer.registerTool.mock.calls[0]![2]!
    mockExecShopify.mockResolvedValue({stdout: 'Usage: shopify theme ...', stderr: '', exitCode: 0})
  })

  test('registers with correct tool name', () => {
    const mockServer = {registerTool: vi.fn()} as any
    registerCliHelp(mockServer, config)
    expect(mockServer.registerTool.mock.calls[0]![0]).toBe('shopify_cli_help')
  })

  test('runs "shopify --help" when no command given', async () => {
    // When
    await handler({})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['--help'])
  })

  test('runs "<command> --help" when command is given', async () => {
    // When
    await handler({command: 'theme push'})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['theme', 'push', '--help'])
  })

  test('appends MCP tips to output', async () => {
    // When
    const result = await handler({})

    // Then
    expect(result.content[0]!.text).toContain('Usage: shopify theme ...')
    expect(result.content[0]!.text).toContain('MCP Usage Tips')
    expect(result.content[0]!.text).toContain('--json')
    expect(result.content[0]!.text).toContain('--force')
  })

  test('propagates isError when help command fails', async () => {
    // Given
    mockExecShopify.mockResolvedValue({stdout: '', stderr: 'Command not found', exitCode: 1})

    // When
    const result = await handler({command: 'nonexistent'})

    // Then
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('Command not found')
    expect(result.content[0]!.text).toContain('MCP Usage Tips')
  })
})
