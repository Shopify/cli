import {InkLifecycleRoot} from './ui.js'
import {SingleTask} from './ui/components/SingleTask.js'
import {outputInfo, outputWarn, outputResult, TokenizedString, unstyled} from '../../public/node/output.js'
import React from 'react'
import {render} from 'ink'
import ansiEscapes from 'ansi-escapes'
import {describe, expect, test, vi} from 'vitest'
import {PassThrough} from 'stream'
// Vitest's console omits the constructor used by Ink's console patch.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'console'

// Ink detects CI when imported; exercise terminal rendering on CI runners too.
vi.hoisted(() => {
  vi.stubEnv('CI', 'false')
  vi.stubEnv('CONTINUOUS_INTEGRATION', 'false')
})
vi.mock('../../public/node/context/local.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../public/node/context/local.js')>()),
  isUnitTest: () => false,
}))

describe('logging during an Ink task', () => {
  test.each([outputInfo, outputWarn])('clears and redraws the task around %o', async (log) => {
    vi.stubGlobal('console', {...console, Console})
    const writes: string[] = []
    const terminal = Object.assign(new PassThrough(), {isTTY: true, columns: 80, rows: 24})
    terminal.on('data', (data: Buffer) => writes.push(data.toString()))
    let finishTask!: () => void
    const taskResult = new Promise<void>((resolve) => {
      finishTask = resolve
    })
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const instance = render(
      <InkLifecycleRoot>
        <SingleTask title={new TokenizedString('Preparing the result')} task={() => taskResult} />
      </InkLifecycleRoot>,
      {
        stdout: terminal as unknown as NodeJS.WriteStream,
        stderr: terminal as unknown as NodeJS.WriteStream,
        patchConsole: true,
        exitOnCtrlC: false,
      },
    )

    try {
      await vi.waitFor(() => expect(writes.join('')).toContain('Preparing the result'))
      expect(writes.join('')).toContain('▀')
      const beforeLog = writes.length

      log('Prepared an item')

      // Clear both UI lines and their trailing newline before writing the log.
      const logWrites = writes.slice(beforeLog)
      const messageIndex = logWrites.findIndex((write) => write.includes('Prepared an item'))
      expect(messageIndex).toBeGreaterThan(0)
      expect(logWrites[messageIndex - 1]).toBe(ansiEscapes.eraseLines(3))
      expect(unstyled(logWrites[messageIndex]!)).toBe('Prepared an item\n')
      expect(logWrites[messageIndex + 1]).toContain('Preparing the result')

      outputResult('{"items":1}')
      expect(stdoutWrite).toHaveBeenCalledWith('{"items":1}\n')
      expect(stderrWrite).not.toHaveBeenCalled()

      const afterLog = writes.length
      finishTask()
      await instance.waitUntilExit()

      const cleanup = writes.slice(afterLog).join('')
      expect(cleanup).toContain(ansiEscapes.eraseLines(3))
      expect(unstyled(cleanup).trim()).toBe('')
    } finally {
      finishTask()
      instance.unmount()
      instance.cleanup()
      stdoutWrite.mockRestore()
      stderrWrite.mockRestore()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      terminal.destroy()
    }
  })
})
