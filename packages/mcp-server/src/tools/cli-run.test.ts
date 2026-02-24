import {registerCliRun} from './cli-run.js'
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
  isLongRunningCommand: (args: string[]) => {
    const cmd = args.join(' ')
    if (cmd.startsWith('theme dev')) return 'theme dev'
    if (cmd.startsWith('app dev')) return 'app dev'
    return undefined
  },
}))

describe('shopify_cli_run', () => {
  const config: McpServerConfig = {shopifyCliPath: 'shopify', store: 'my-store.myshopify.com', timeout: 120_000}
  let handler: (params: {[key: string]: unknown}) => Promise<ToolResult>

  beforeEach(() => {
    const mockServer = {registerTool: vi.fn()} as any
    registerCliRun(mockServer, config)
    handler = mockServer.registerTool.mock.calls[0]![2]!
    mockExecShopify.mockResolvedValue({stdout: '[]', stderr: '', exitCode: 0})
    mockFormatToolResult.mockReturnValue({content: [{type: 'text', text: '[]'}]})
  })

  test('registers with correct tool name', () => {
    const mockServer = {registerTool: vi.fn()} as any
    registerCliRun(mockServer, config)
    expect(mockServer.registerTool.mock.calls[0]![0]).toBe('shopify_cli_run')
  })

  test('splits command string into args', async () => {
    // When
    await handler({command: 'theme list --json'})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['theme', 'list', '--json'])
  })

  test('handles command with multiple flags', async () => {
    // When
    await handler({command: 'theme push --force --json --theme 12345'})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['theme', 'push', '--force', '--json', '--theme', '12345'])
  })

  test('filters empty strings from split', async () => {
    // When
    await handler({command: '  theme  list  '})

    // Then
    expect(mockExecShopify).toHaveBeenCalledWith(config, ['theme', 'list'])
  })

  test('blocks long-running commands with helpful message', async () => {
    // When
    const result = await handler({command: 'theme dev --store my-store.myshopify.com'})

    // Then
    expect(mockExecShopify).not.toHaveBeenCalled()
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('long-running')
    expect(result.content[0]!.text).toContain('separate terminal')
  })

  test('blocks app dev as long-running', async () => {
    // When
    const result = await handler({command: 'app dev'})

    // Then
    expect(mockExecShopify).not.toHaveBeenCalled()
    expect(result.isError).toBe(true)
  })

  test('passes result through formatToolResult', async () => {
    // Given
    const execResult = {stdout: '{"id":1}', stderr: '', exitCode: 0}
    mockExecShopify.mockResolvedValue(execResult)

    // When
    await handler({command: 'theme info --json'})

    // Then
    expect(mockFormatToolResult).toHaveBeenCalledWith(execResult)
  })
})
