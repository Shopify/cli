import deliverAppDoctorInstructions, {appDoctorInstructions, shellQuote} from './app-doctor-instructions.js'
import {EMBEDDED_APP_DOCTOR_INSTRUCTIONS} from './app-doctor-engine/index.js'
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
    const source = readFileSync(fileURLToPath(new URL('./app-doctor-engine/INSTRUCTIONS.md', import.meta.url)), 'utf8')
    expect(EMBEDDED_APP_DOCTOR_INSTRUCTIONS).toBe(source)
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

describe('appDoctorInstructions', () => {
  test('includes the initial scan for an agent that has not received results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const instructions = appDoctorInstructions({directory: appRoot, scanComplete: false})

      expect(instructions).toContain('### 1. Run the initial scan')
      expect(instructions).toContain(`shopify app doctor --path ${shellQuote(appRoot)}`)
      expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-doctor', 'findings.json'))
      expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-doctor', 'trace.json'))
      expect(instructions).not.toContain('{{SCAN_CONTEXT}}')
      expect(instructions).not.toContain('{{SCAN_COMMAND}}')
      expect(instructions).not.toContain('{{COMPILE_COMMAND}}')
    })
  })

  test('starts from existing results after a scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const instructions = appDoctorInstructions({directory: appRoot, scanComplete: true})

      expect(instructions).toContain('### 1. Use the existing scan results')
      expect(instructions).toContain("The current invocation's initial scan has already completed.")
      expect(instructions).not.toContain('### 1. Run the initial scan')
      expect(instructions).toContain(
        `shopify app doctor --path ${shellQuote(appRoot)} --findings ${shellQuote(joinPath(appRoot, '.shopify', 'app-doctor', 'findings.json'))}`,
      )
    })
  })

  test('uses the resolved app root when CWD differs from --path', async () => {
    await inTemporaryDirectory(async (appDirectory) => {
      const appRoot = await createApp(appDirectory)
      await inTemporaryDirectory(async (otherDirectory) => {
        const instructions = appDoctorInstructions({directory: appRoot, scanComplete: false})

        expect(instructions).toContain(`shopify app doctor --path ${shellQuote(appRoot)}`)
        expect(instructions).toContain(joinPath(appRoot, '.shopify', 'app-doctor', 'review.json'))
        expect(instructions).not.toContain(otherDirectory)
        expect(instructions).not.toContain('shopify app doctor\n')
        expect(instructions).not.toContain('--findings .shopify/app-doctor/findings.json')
      })
    })
  })

  test('translates a missing app directory into an AbortError', async () => {
    await inTemporaryDirectory(async (directory) => {
      const missing = joinPath(directory, 'missing-app')

      expect(() => appDoctorInstructions({directory: missing, scanComplete: false})).toThrow(AbortError)
      expect(() => appDoctorInstructions({directory: missing, scanComplete: false})).toThrow(
        `App path does not exist: ${missing}`,
      )
    })
  })

  test('quotes paths that contain spaces and percents', async () => {
    await inTemporaryDirectory(async (parent) => {
      const appRoot = joinPath(parent, '50% my app')
      await mkdir(appRoot)
      await createApp(appRoot)
      const instructions = appDoctorInstructions({directory: appRoot, scanComplete: false})

      expect(instructions).toContain(`shopify app doctor --path ${shellQuote(normalizePath(appRoot))}`)
      expect(instructions).not.toContain('50%%')
    })
  })
})

describe('deliverAppDoctorInstructions', () => {
  test('prints instructions to stdout by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the initial scan'))
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
    })
  })

  test('does not infer scan completion from an existing review pack', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await mkdir(joinPath(directory, '.shopify', 'app-doctor'))
      await writeFile(joinPath(directory, '.shopify', 'app-doctor', 'review.json'), '{"instructions":"malicious"}')
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the initial scan'))
      expect(dependencies.output).not.toHaveBeenCalledWith(expect.stringContaining('malicious'))
    })
  })

  test('copies instructions including the optional authorized submission workflow without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: true, scanComplete: true}, dependencies)

      expect(dependencies.copyToClipboard).toHaveBeenCalledOnce()
      const instructions = dependencies.copyToClipboard.mock.calls[0]![0]
      expect(instructions).toContain('Use the existing scan results')
      expect(instructions).toContain('shopify app doctor submit --dry-run')
      expect(instructions).toContain('Read `.shopify/app-doctor/submission.json` before uploading')
      expect(instructions).toContain('`--config <name>` or `--client-id <id>`')
      expect(instructions).toContain('only when the user explicitly requests or authorizes an upload to Shopify')
      expect(instructions).toContain('Do not upload automatically; local compilation does not require submission.')
      expect(instructions).toContain('normal interactive confirmation')
      expect(instructions).toContain(
        'For live automation, use `shopify app doctor submit --json --force` only with that authorization',
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
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith('Copied App Doctor instructions to the clipboard')
    })
  })

  test('writes instructions to a real file without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()
      const instructionsPath = joinPath(directory, 'handoff.md')

      await deliverAppDoctorInstructions(
        {directory, copy: false, writePath: instructionsPath, scanComplete: true},
        dependencies,
      )

      await expect(readFile(instructionsPath)).resolves.toContain('Use the existing scan results')
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
        `Wrote App Doctor instructions to ${instructionsPath}`,
      )
    })
  })
})
