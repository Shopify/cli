import {vi} from 'vitest'
import stripAnsi from 'strip-ansi'
import EventEmitter from 'events'

class Stream extends EventEmitter {
  columns!: number
  write!: (str: string) => void
  get!: () => string | undefined
}

export function createStdout(columns?: number): Stream {
  const stdout = new Stream()
  stdout.columns = columns ?? 80
  stdout.write = vi.fn()
  stdout.get = () => stripAnsi(vi.mocked(stdout.write).mock.lastCall?.[0] ?? '')

  return stdout
}
