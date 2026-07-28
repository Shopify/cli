import {emitClaudeCodePluginHint, runningUnderClaudeCode, SHOPIFY_AI_TOOLKIT_PLUGIN_HINT} from './plugin-hints.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

describe('runningUnderClaudeCode', () => {
  test.each(['1', 'true', 'TRUE', 'yes', 'YES'])('returns true for CLAUDECODE=%s', (value) => {
    expect(runningUnderClaudeCode({CLAUDECODE: value})).toBe(true)
  })

  test('returns true for a Claude Code child session', () => {
    expect(runningUnderClaudeCode({CLAUDE_CODE_CHILD_SESSION: '1'})).toBe(true)
  })

  test('returns false without a truthy Claude Code variable', () => {
    expect(runningUnderClaudeCode({CLAUDECODE: '0', CLAUDE_CODE_CHILD_SESSION: 'false'})).toBe(false)
  })
})

describe('emitClaudeCodePluginHint', () => {
  let write: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  test('writes the exact marker on every invocation under Claude Code', () => {
    emitClaudeCodePluginHint({CLAUDECODE: '1'})
    emitClaudeCodePluginHint({CLAUDECODE: '1'})

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, `${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
    expect(write).toHaveBeenNthCalledWith(2, `${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  })

  test('does not write outside Claude Code', () => {
    emitClaudeCodePluginHint({})

    expect(write).not.toHaveBeenCalled()
  })

  test('does not make errors fatal', () => {
    write.mockImplementation(() => {
      throw new Error('write failed')
    })

    expect(() => emitClaudeCodePluginHint({CLAUDECODE: '1'})).not.toThrow()
  })
})
