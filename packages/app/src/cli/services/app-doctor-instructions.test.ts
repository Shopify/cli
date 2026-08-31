import deliverAppDoctorInstructions, {appDoctorInstructions} from './app-doctor-instructions.js'
import {fileExists, inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

function testDependencies() {
  return {
    reviewPackExists: fileExists,
    copyToClipboard: vi.fn(async (_content: string) => {}),
    writeToFile: writeFile,
    output: vi.fn(),
    outputConfirmation: vi.fn(),
  }
}

describe('appDoctorInstructions', () => {
  test('includes the initial scan for an agent that has not received results', () => {
    const instructions = appDoctorInstructions(false)

    expect(instructions).toContain('### 1. Run the initial scan from the app root')
    expect(instructions).toContain('shopify app doctor scan')
    expect(instructions).toContain('app-doctor-findings.json')
    expect(instructions).toContain('app-doctor-trace.json')
    expect(instructions).not.toContain('{{SCAN_CONTEXT}}')
  })

  test('starts from existing results after a scan', () => {
    const instructions = appDoctorInstructions(true)

    expect(instructions).toContain('### 1. Use the existing scan results')
    expect(instructions).toContain('The initial scan has already completed.')
    expect(instructions).not.toContain('### 1. Run the initial scan from the app root')
    expect(instructions).toContain('shopify app doctor scan --findings app-doctor-findings.json')
  })
})

describe('deliverAppDoctorInstructions', () => {
  test('prints instructions to stdout by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the initial scan'))
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
    })
  })

  test('uses existing scan results when the review pack exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'app-doctor-review.json'), '{}')
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: false}, dependencies)

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Use the existing scan results'))
    })
  })

  test('copies instructions without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies()

      await deliverAppDoctorInstructions({directory, copy: true, scanComplete: true}, dependencies)

      expect(dependencies.copyToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('Use the existing scan results'),
      )
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith('Copied App Doctor instructions to the clipboard')
    })
  })

  test('writes instructions to a real file without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
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
