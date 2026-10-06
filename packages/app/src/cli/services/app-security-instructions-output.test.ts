import {deliverAppSecurityInstructions, renderAppSecurityInstructions} from './app-security-instructions-output.js'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

function deliveryDependencies() {
  return {
    copyToClipboard: vi.fn(async (_content: string) => {}),
    writeToFile: vi.fn(writeFile),
  }
}

function renderDependencies() {
  return {
    output: vi.fn(),
    outputConfirmation: vi.fn(),
  }
}

describe('deliverAppSecurityInstructions', () => {
  test('copies the instructions to the clipboard', async () => {
    const dependencies = deliveryDependencies()

    await deliverAppSecurityInstructions('# Instructions', {copy: true}, dependencies)

    expect(dependencies.copyToClipboard).toHaveBeenCalledWith('# Instructions')
    expect(dependencies.writeToFile).not.toHaveBeenCalled()
  })

  test('writes the instructions to a real file, ending with a newline', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = deliveryDependencies()
      const instructionsPath = joinPath(directory, 'handoff.md')

      await deliverAppSecurityInstructions('# Instructions', {copy: false, writePath: instructionsPath}, dependencies)

      await expect(readFile(instructionsPath)).resolves.toBe('# Instructions\n')
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
    })
  })

  test('does nothing with instructions that are neither copied nor written', async () => {
    const dependencies = deliveryDependencies()

    await deliverAppSecurityInstructions('# Instructions', {copy: false}, dependencies)

    expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
    expect(dependencies.writeToFile).not.toHaveBeenCalled()
  })

  test('fails when the file cannot be written', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(
        deliverAppSecurityInstructions('# Instructions', {copy: false, writePath: directory}, deliveryDependencies()),
      ).rejects.toThrow()
    })
  })
})

describe('renderAppSecurityInstructions', () => {
  test('prints instructions that were neither copied nor written', () => {
    const dependencies = renderDependencies()

    renderAppSecurityInstructions({content: '# Instructions', copiedToClipboard: false, path: null}, dependencies)

    expect(dependencies.output).toHaveBeenCalledWith('# Instructions')
    expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
  })

  test('confirms a copy without printing the instructions', () => {
    const dependencies = renderDependencies()

    renderAppSecurityInstructions({content: '# Instructions', copiedToClipboard: true, path: null}, dependencies)

    expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
      'Copied app security check instructions to the clipboard',
    )
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('confirms a written file by its path without printing the instructions', () => {
    const dependencies = renderDependencies()

    renderAppSecurityInstructions(
      {content: '# Instructions', copiedToClipboard: false, path: '/tmp/handoff.md'},
      dependencies,
    )

    expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
      'Wrote app security check instructions to /tmp/handoff.md',
    )
    expect(dependencies.output).not.toHaveBeenCalled()
  })
})
