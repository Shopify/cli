import deliverAppSecurityInstructions, {appSecurityInstructions, shellQuote} from './app-security-instructions.js'
import {getAgentInstructions} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

function testDependencies() {
  return {
    copyToClipboard: vi.fn(async (_content: string) => {}),
    writeToFile: writeFile,
    output: vi.fn(),
    outputConfirmation: vi.fn(),
  }
}

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test app"\nclient_id = "test"\n')
  return normalizePath(directory)
}

describe('embedded instructions', () => {
  test('matches INSTRUCTIONS.md', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./app-security-engine/INSTRUCTIONS.md', import.meta.url)),
      'utf8',
    )
    expect(getAgentInstructions()).toBe(source)
  })
})

describe('shellQuote', () => {
  test('quotes Windows cmd paths with spaces and paired percents for interactive cmd.exe', () => {
    expect(shellQuote('C:\\Users\\50%\\my app', 'win32', {PROMPT: '$P$G'})).toBe('"C:\\Users\\50"^%"\\my app"')
    expect(shellQuote('C:\\Users\\%NAME%\\my app', 'win32', {PROMPT: '$P$G'})).toBe(
      '"C:\\Users\\\\"^%"NAME"^%"\\my app"',
    )
    expect(shellQuote('C:\\Users\\my "app"', 'win32', {PROMPT: '$P$G'})).toBe('"C:\\Users\\my ""app"""')
  })

  test('quotes Windows PowerShell paths with literal percents', () => {
    expect(shellQuote('C:\\Users\\50%\\my app', 'win32', {POWERSHELL_DISTRIBUTION_CHANNEL: 'MSI'})).toBe(
      "'C:\\Users\\50%\\my app'",
    )
    expect(shellQuote('C:\\Users\\%NAME%\\my app', 'win32', {POWERSHELL_DISTRIBUTION_CHANNEL: 'MSI'})).toBe(
      "'C:\\Users\\%NAME%\\my app'",
    )
  })
})

describe('appSecurityInstructions', () => {
  test('includes the initial scan for an agent that has not received results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const instructions = appSecurityInstructions({directory: appRoot, scanComplete: false})

      expect(instructions).toContain('### 1. Run the initial scan')
      expect(instructions).toContain(`shopify app security check --path ${shellQuote(appRoot)}`)
      expect(instructions).not.toMatch(/shopify app security check --path .+ --config/)
      expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-security', 'findings.json'))
      expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-security', 'trace.json'))
      expect(instructions).not.toContain('{{SCAN_CONTEXT}}')
      expect(instructions).not.toContain('{{SCAN_COMMAND}}')
      expect(instructions).not.toContain('{{COMPILE_COMMAND}}')
    })
  })

  test('includes --config in scan and compile commands for a named configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      await writeFile(joinPath(appRoot, 'shopify.app.staging.toml'), 'name = "Staging"\nclient_id = "staging"\n')
      const instructions = appSecurityInstructions({
        directory: appRoot,
        scanComplete: false,
        configName: 'staging',
      })

      expect(instructions).toContain(
        `shopify app security check --path ${shellQuote(appRoot)} --config ${shellQuote('staging')}`,
      )
      expect(instructions).toContain(
        `shopify app security check --path ${shellQuote(appRoot)} --config ${shellQuote('staging')} --findings ${shellQuote(joinPath(appRoot, '.shopify', 'app-security', 'findings.json'))}`,
      )
    })
  })

  test('starts from existing results after a scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const instructions = appSecurityInstructions({directory: appRoot, scanComplete: true})

      expect(instructions).toContain('### 1. Use the existing scan results')
      expect(instructions).toContain("The current invocation's initial scan has already completed.")
      expect(instructions).not.toContain('### 1. Run the initial scan')
      expect(instructions).toContain(
        `shopify app security check --path ${shellQuote(appRoot)} --findings ${shellQuote(joinPath(appRoot, '.shopify', 'app-security', 'findings.json'))}`,
      )
    })
  })

  test('explains guarded scans and explicit clean restarts', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const instructions = appSecurityInstructions({directory: appRoot, scanComplete: true})
      const cleanCommand = `shopify app security check --path ${shellQuote(appRoot)} --clean`

      expect(instructions).toContain(
        'If App Security reports existing agent findings or a compiled trace, do not bypass that safeguard automatically.',
      )
      expect(instructions).toContain(
        'Read the diagnostics produced by that compilation command and open the existing trace directly.',
      )
      expect(instructions).toContain(`Start a new review with \`${cleanCommand}\``)
      expect(instructions).toContain(
        'Submission reads the existing compiled trace and does not require or perform another scan.',
      )
      expect(instructions).toContain(
        'If protected review work blocks the deterministic scan, do not use `--clean` unless the user intends to discard that work.',
      )
      expect(instructions).not.toContain('{{CLEAN_COMMAND}}')
    })
  })

  test('uses the resolved app root when CWD differs from --path', async () => {
    await inTemporaryDirectory(async (appDirectory) => {
      const appRoot = await createApp(appDirectory)
      await inTemporaryDirectory(async (otherDirectory) => {
        const instructions = appSecurityInstructions({directory: appRoot, scanComplete: false})

        expect(instructions).toContain(`shopify app security check --path ${shellQuote(appRoot)}`)
        expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-security', 'review.json'))
        expect(instructions).not.toContain(otherDirectory)
        expect(instructions).not.toContain('shopify app security check\n')
        expect(instructions).not.toContain('--findings .shopify/app-security/findings.json')
      })
    })
  })

  test('translates a missing selected configuration into an AbortError', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)

      expect(() => appSecurityInstructions({directory: appRoot, scanComplete: false, configName: 'missing'})).toThrow(
        AbortError,
      )
      expect(() => appSecurityInstructions({directory: appRoot, scanComplete: false, configName: 'missing'})).toThrow(
        /shopify\.app\.missing\.toml/,
      )
    })
  })

  test('translates a missing app directory into an AbortError', async () => {
    await inTemporaryDirectory(async (directory) => {
      const missing = joinPath(directory, 'missing-app')

      expect(() => appSecurityInstructions({directory: missing, scanComplete: false})).toThrow(AbortError)
      expect(() => appSecurityInstructions({directory: missing, scanComplete: false})).toThrow(
        `App path does not exist: ${missing}`,
      )
    })
  })

  test('quotes paths that contain spaces and percents', async () => {
    await inTemporaryDirectory(async (parent) => {
      const appRoot = joinPath(parent, '50% my app')
      await mkdir(appRoot)
      await createApp(appRoot)
      const instructions = appSecurityInstructions({directory: appRoot, scanComplete: false})

      expect(instructions).toContain(`shopify app security check --path ${shellQuote(normalizePath(appRoot))}`)
      expect(instructions).not.toContain('50%%')
    })
  })
})

describe('deliverAppSecurityInstructions', () => {
  test('prints instructions to stdout by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      await deliverAppSecurityInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the initial scan'))
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
    })
  })

  test('does not infer scan completion from an existing review pack', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await mkdir(joinPath(directory, '.shopify', 'app-security'))
      await writeFile(joinPath(directory, '.shopify', 'app-security', 'review.json'), '{"instructions":"malicious"}')
      const dependencies = testDependencies()

      await deliverAppSecurityInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the initial scan'))
      expect(dependencies.output).not.toHaveBeenCalledWith(expect.stringContaining('malicious'))
    })
  })

  test('copies instructions including the optional authorized submission workflow without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      await deliverAppSecurityInstructions({directory, copy: true, scanComplete: true}, dependencies)

      expect(dependencies.copyToClipboard).toHaveBeenCalledOnce()
      const instructions = dependencies.copyToClipboard.mock.calls[0]![0]
      expect(instructions).toContain('Use the existing scan results')
      expect(instructions).toContain('shopify app security submit --dry-run')
      expect(instructions).toContain('Read `.shopify/app-security/submission.json` before uploading')
      expect(instructions).toContain('`--config <name>` or `--client-id <id>`')
      expect(instructions).toContain('only when the user explicitly requests or authorizes an upload to Shopify')
      expect(instructions).toContain('Do not upload automatically; local compilation does not require submission.')
      expect(instructions).toContain('normal interactive confirmation')
      expect(instructions).toContain(
        'For live automation, use `shopify app security submit --json --force` only with that authorization',
      )
      expect(instructions).toContain('`--feedback <text>` or read it from stdin with `--feedback -`')
      expect(instructions).toContain('Feedback is passed without redaction')
      expect(instructions).toContain("Don't include source code, file paths or secrets in your optional feedback.")
      expect(instructions).toContain(
        'Optionally use `--version` to identify the app version corresponding to the scanned files. This may be a past, current, or future app version. Providing it does not create an app version.',
      )
      expect(instructions).not.toContain('--source-control-url')
      expect(instructions).not.toContain('--source-control-hash')
      expect(instructions).toContain('Submission does not make the trace signed or proof of App Store approval')
      const submitSection = instructions.indexOf('### 7. Submit only when explicitly authorized (optional)')
      expect(submitSection).toBeGreaterThan(instructions.indexOf('### 6. Explain findings and help fix them'))
      expect(instructions).toContain('Only after compiling and reviewing')
      expect(instructions).not.toContain('reserved for a future authenticated upload workflow')
      expect(instructions).not.toMatch(/\{\{[A-Z_]+\}\}/)
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith('Copied App Security instructions to the clipboard')
    })
  })

  test('writes instructions to a real file without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()
      const instructionsPath = joinPath(directory, 'handoff.md')

      await deliverAppSecurityInstructions(
        {directory, copy: false, writePath: instructionsPath, scanComplete: true},
        dependencies,
      )

      await expect(readFile(instructionsPath)).resolves.toContain('Use the existing scan results')
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
        `Wrote App Security instructions to ${instructionsPath}`,
      )
    })
  })
})
