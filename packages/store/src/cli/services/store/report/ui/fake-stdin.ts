import {PassThrough} from 'node:stream'

/** Creates an inert stdin with the full stream contract Ink expects in non-interactive renders. */
export function createFakeStdin(): NodeJS.ReadStream {
  const fakeStdin = Object.assign(new PassThrough(), {
    isTTY: true as const,
    setRawMode: () => {},
    ref: () => fakeStdin,
    unref: () => fakeStdin,
  })

  // PassThrough provides Ink's Readable/EventEmitter methods, while the properties above provide
  // the terminal-specific methods it probes. Node's types model ReadStream as a concrete TTY socket,
  // so use one explicit assertion at this boundary for the deliberately synthetic implementation.
  const stdinBoundary: unknown = fakeStdin
  return stdinBoundary as NodeJS.ReadStream
}
