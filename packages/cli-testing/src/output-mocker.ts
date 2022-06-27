// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import {output} from '@shopify/cli-kit'
import {vi} from 'vitest'
import stripAnsi from 'strip-ansi'

export function mockAndCapture() {
  const collectedOutput: string[] = []
  const collectedInfo: string[] = []
  const collectedDebug: string[] = []
  const collectedSuccess: string[] = []
  const collectedCompleted: string[] = []
  const collectedWarn: string[] = []

  const infoSpy = vi.spyOn(output, 'info').mockImplementation((content) => {
    collectedOutput.push(stripAnsi(output.stringifyMessage(content) ?? ''))
    collectedInfo.push(stripAnsi(output.stringifyMessage(content) ?? ''))
  })
  const debugSpy = vi.spyOn(output, 'debug').mockImplementation((content) => {
    collectedOutput.push(stripAnsi(output.stringifyMessage(content) ?? ''))
    collectedDebug.push(stripAnsi(output.stringifyMessage(content) ?? ''))
  })
  const successSpy = vi.spyOn(output, 'success').mockImplementation((content) => {
    collectedOutput.push(stripAnsi(output.stringifyMessage(content) ?? ''))
    collectedSuccess.push(stripAnsi(output.stringifyMessage(content) ?? ''))
  })
  const completedSpy = vi.spyOn(output, 'completed').mockImplementation((content) => {
    collectedOutput.push(stripAnsi(output.stringifyMessage(content) ?? ''))
    collectedCompleted.push(stripAnsi(output.stringifyMessage(content) ?? ''))
  })
  const outputSpy = vi.spyOn(output, 'warn').mockImplementation((content) => {
    collectedOutput.push(stripAnsi(output.stringifyMessage(content) ?? ''))
    collectedWarn.push(stripAnsi(output.stringifyMessage(content) ?? ''))
  })
  return {
    output: () => collectedOutput.join('\n'),
    info: () => collectedInfo.join('\n'),
    debug: () => collectedDebug.join('\n'),
    success: () => collectedSuccess.join('\n'),
    completed: () => collectedCompleted.join('\n'),
    warn: () => collectedWarn.join('\n'),
    clear: () => {
      infoSpy.mockClear()
      debugSpy.mockClear()
      successSpy.mockClear()
      completedSpy.mockClear()
      outputSpy.mockClear()
    },
  }
}
