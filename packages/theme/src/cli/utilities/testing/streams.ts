import {vi} from 'vitest'
// Use Node's console so Vitest does not intercept stderr before the stream capture.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

export function captureStandardStreams() {
  vi.stubGlobal('console', Object.assign(new Console({stdout: process.stdout, stderr: process.stderr}), {Console}))
  const stdout: string[] = []
  const stderr: string[] = []
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout.push(Buffer.from(chunk).toString('utf8'))
    return true
  })
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stderr.push(Buffer.from(chunk).toString('utf8'))
    return true
  })
  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      vi.unstubAllGlobals()
    },
  }
}
