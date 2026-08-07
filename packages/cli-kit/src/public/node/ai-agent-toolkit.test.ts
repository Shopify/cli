import {
  aiAgentHarnessName,
  aiToolkitInstallCommand,
  detectAIAgentHarness,
  isAIToolkitInstalled,
  isRunningInsideAIAgent,
  suggestAIToolkitInstallIfNeeded,
} from './ai-agent-toolkit.js'
import {homeDirectory} from './context/local.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {outputInfo} from './output.js'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'

vi.mock('./context/local.js', async () => {
  const actual = await vi.importActual<typeof import('./context/local.js')>('./context/local.js')
  return {...actual, homeDirectory: vi.fn()}
})
vi.mock('./output.js', async () => {
  const actual = await vi.importActual<typeof import('./output.js')>('./output.js')
  return {...actual, outputInfo: vi.fn()}
})

let originalIsTTY: boolean | undefined

beforeEach(() => {
  originalIsTTY = process.stdout.isTTY
  vi.unstubAllEnvs()
})

afterEach(() => {
  Object.defineProperty(process.stdout, 'isTTY', {value: originalIsTTY, configurable: true, writable: true})
})

describe('detectAIAgentHarness', () => {
  test('detects pi via PI_CODING_AGENT', () => {
    expect(detectAIAgentHarness({PI_CODING_AGENT: '1'})).toBe('pi')
  })

  test('detects claude code via CLAUDE_CODE', () => {
    expect(detectAIAgentHarness({CLAUDE_CODE: '1'})).toBe('claude-code')
  })

  test('detects codex via CODEX_THREAD_ID', () => {
    expect(detectAIAgentHarness({CODEX_THREAD_ID: 'thread-123'})).toBe('codex')
  })

  test('returns undefined when no known env var is present', () => {
    expect(detectAIAgentHarness({})).toBeUndefined()
  })

  test('ignores empty string values', () => {
    expect(detectAIAgentHarness({CLAUDE_CODE: ''})).toBeUndefined()
  })
})

describe('isRunningInsideAIAgent', () => {
  test('returns true when non-tty and a harness env var is present', () => {
    Object.defineProperty(process.stdout, 'isTTY', {value: false, configurable: true, writable: true})
    expect(isRunningInsideAIAgent({CLAUDE_CODE: '1'})).toBe(true)
  })

  test('returns false when tty even if a harness env var is present', () => {
    Object.defineProperty(process.stdout, 'isTTY', {value: true, configurable: true, writable: true})
    expect(isRunningInsideAIAgent({CLAUDE_CODE: '1'})).toBe(false)
  })

  test('returns false when non-tty but no harness env var is present', () => {
    Object.defineProperty(process.stdout, 'isTTY', {value: false, configurable: true, writable: true})
    expect(isRunningInsideAIAgent({})).toBe(false)
  })
})

describe('aiToolkitInstallCommand / aiAgentHarnessName', () => {
  test('returns the expected install command and name per harness', () => {
    expect(aiToolkitInstallCommand('pi')).toContain('npx skills add')
    expect(aiToolkitInstallCommand('claude-code')).toContain('claude plugin install')
    expect(aiToolkitInstallCommand('codex')).toContain('codex plugin add')

    expect(aiAgentHarnessName('pi')).toBe('Pi')
    expect(aiAgentHarnessName('claude-code')).toBe('Claude Code')
    expect(aiAgentHarnessName('codex')).toBe('Codex')
  })
})

describe('isAIToolkitInstalled', () => {
  test('returns true for pi when a shopify- skill directory exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.pi', 'agent', 'skills', 'shopify-admin'))

      await expect(isAIToolkitInstalled('pi')).resolves.toBe(true)
    })
  })

  test('returns false for pi when no shopify- skill directory exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.pi', 'agent', 'skills', 'some-other-skill'))

      await expect(isAIToolkitInstalled('pi')).resolves.toBe(false)
    })
  })

  test('returns false for pi when the skills directory does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await expect(isAIToolkitInstalled('pi')).resolves.toBe(false)
    })
  })

  test('returns true for claude-code when installed_plugins.json references shopify', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.claude', 'plugins'))
      await writeFile(
        joinPath(tmpDir, '.claude', 'plugins', 'installed_plugins.json'),
        JSON.stringify({plugins: ['shopify-ai-toolkit@claude-plugins-official']}),
      )

      await expect(isAIToolkitInstalled('claude-code')).resolves.toBe(true)
    })
  })

  test('returns true for claude-code via the plugin cache fallback', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.claude', 'plugins', 'cache', 'claude-plugins-official', 'shopify-ai-toolkit'))

      await expect(isAIToolkitInstalled('claude-code')).resolves.toBe(true)
    })
  })

  test('returns false for claude-code when nothing is installed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await expect(isAIToolkitInstalled('claude-code')).resolves.toBe(false)
    })
  })

  test('returns true for codex when config.toml references shopify', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.codex'))
      await writeFile(joinPath(tmpDir, '.codex', 'config.toml'), '[plugins.shopify]\nenabled = true\n')

      await expect(isAIToolkitInstalled('codex')).resolves.toBe(true)
    })
  })

  test('returns false for codex when nothing is installed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await expect(isAIToolkitInstalled('codex')).resolves.toBe(false)
    })
  })
})

describe('suggestAIToolkitInstallIfNeeded', () => {
  beforeEach(() => {
    vi.mocked(outputInfo).mockClear()
  })

  test('prints a suggestion when running inside an agent without the toolkit installed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      Object.defineProperty(process.stdout, 'isTTY', {value: false, configurable: true, writable: true})
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await suggestAIToolkitInstallIfNeeded({CLAUDE_CODE: '1'})

      expect(outputInfo).toHaveBeenCalledOnce()
      expect(vi.mocked(outputInfo).mock.calls[0]?.[0]).toContain('claude plugin install')
    })
  })

  test('does not print when running interactively', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      Object.defineProperty(process.stdout, 'isTTY', {value: true, configurable: true, writable: true})
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await suggestAIToolkitInstallIfNeeded({CLAUDE_CODE: '1'})

      expect(outputInfo).not.toHaveBeenCalled()
    })
  })

  test('does not print when no harness is detected', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      Object.defineProperty(process.stdout, 'isTTY', {value: false, configurable: true, writable: true})
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)

      await suggestAIToolkitInstallIfNeeded({})

      expect(outputInfo).not.toHaveBeenCalled()
    })
  })

  test('does not print when the toolkit is already installed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      Object.defineProperty(process.stdout, 'isTTY', {value: false, configurable: true, writable: true})
      vi.mocked(homeDirectory).mockReturnValue(tmpDir)
      await mkdir(joinPath(tmpDir, '.pi', 'agent', 'skills', 'shopify-admin'))

      await suggestAIToolkitInstallIfNeeded({PI_CODING_AGENT: '1'})

      expect(outputInfo).not.toHaveBeenCalled()
    })
  })
})
