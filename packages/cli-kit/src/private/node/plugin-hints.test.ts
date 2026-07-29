import {emitClaudeCodePluginHint, runningUnderClaudeCode, SHOPIFY_AI_TOOLKIT_PLUGIN_HINT} from './plugin-hints.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

describe('runningUnderClaudeCode', () => {
  test.each(['1', 'true', 'TRUE', 'yes', 'YES'])('returns true for CLAUDECODE=%s', (value) => {
    expect(runningUnderClaudeCode({CLAUDECODE: value})).toBe(true)
  })

  test('returns true for a Claude Code child session', () => {
    expect(runningUnderClaudeCode({CLAUDE_CODE_CHILD_SESSION: '1'})).toBe(true)
  })

  test.each([
    ['CLAUDECODE', ''],
    ['CLAUDECODE', '0'],
    ['CLAUDECODE', 'false'],
    ['CLAUDE_CODE_CHILD_SESSION', ''],
    ['CLAUDE_CODE_CHILD_SESSION', '0'],
    ['CLAUDE_CODE_CHILD_SESSION', 'false'],
  ])('returns false for %s=%s when the other marker is absent', (variable, value) => {
    expect(runningUnderClaudeCode({[variable]: value})).toBe(false)
  })
})

describe('emitClaudeCodePluginHint', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdout: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  test.each([
    ['CLAUDECODE', '1'],
    ['CLAUDECODE', 'true'],
    ['CLAUDE_CODE_CHILD_SESSION', '1'],
    ['CLAUDE_CODE_CHILD_SESSION', 'true'],
  ])('writes the marker for %s=%s', (variable, value) => {
    emitClaudeCodePluginHint({[variable]: value})

    expect(write).toHaveBeenCalledWith(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
    expect(stdout).not.toHaveBeenCalled()
  })

  test.each([
    ['CLAUDECODE', ''],
    ['CLAUDECODE', '0'],
    ['CLAUDECODE', 'false'],
    ['CLAUDE_CODE_CHILD_SESSION', ''],
    ['CLAUDE_CODE_CHILD_SESSION', '0'],
    ['CLAUDE_CODE_CHILD_SESSION', 'false'],
  ])('does not write for %s=%s', (variable, value) => {
    emitClaudeCodePluginHint({[variable]: value})

    expect(write).not.toHaveBeenCalled()
  })

  test('writes the exact marker on every command invocation under Claude Code', () => {
    emitClaudeCodePluginHint({CLAUDECODE: '1'})
    emitClaudeCodePluginHint({CLAUDECODE: '1'})

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, `${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
    expect(write).toHaveBeenNthCalledWith(2, `${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  })
})
