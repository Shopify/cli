import {ConcurrentOutputContext, getConcurrentOutputContext, useConcurrentOutputContext} from './output-context.js'
import {unstyled} from '../../public/node/output.js'
import {
  defineJsonOutputSchema,
  formatJsonOutputTimestamp,
  jsonOutputTimestampSchema,
} from '../../public/node/json-output-schema.js'
import {zod} from '../../public/node/schema.js'
import {createWriteStream} from 'fs'
import {Writable, type WritableOptions} from 'stream'
import {finished} from 'stream/promises'
import {StringDecoder} from 'string_decoder'
import {once} from 'events'

export const devInstanceLogOutputSchema = defineJsonOutputSchema({
  name: 'DevInstanceLogEntry',
  schema: zod
    .object({
      timestamp: jsonOutputTimestampSchema,
      source: zod
        .string()
        .optional()
        .describe('What produced the line, for example a process prefix like web or extensions, when needed.'),
      level: zod.enum(['debug', 'info', 'warning', 'error']).optional(),
      message: zod.string(),
    })
    .strict(),
})

/** One line of a dev instance's JSON Lines log. */
export type DevInstanceLogEntry = zod.infer<typeof devInstanceLogOutputSchema.schema>

interface DevInstanceOutputOptions {
  logFile: string
  logOutput?: Writable
  isActive: () => boolean
  onError: (error: unknown) => void
}

export function createDevInstanceOutput({logFile, logOutput, isActive, onError}: DevInstanceOutputOptions) {
  // Each run starts a fresh log.
  const logStream = createWriteStream(logFile, {flags: 'w', mode: 0o600})
  logStream.on('error', onError)
  logOutput?.on('error', onError)
  const opened = once(logStream, 'open')
  const outputs = new Set<Writable>()

  const writeLogEntry = async (entry: Omit<DevInstanceLogEntry, 'timestamp'> & {timestamp?: string}) => {
    if (!isActive()) return
    const record = devInstanceLogOutputSchema.validate({
      ...entry,
      timestamp: entry.timestamp ?? formatJsonOutputTimestamp(new Date()),
    })
    const line = `${JSON.stringify(record)}\n`
    try {
      await writeToStream(logStream, line)
      if (logOutput) await writeToStream(logOutput, line)
    } catch (error) {
      onError(error)
      throw error
    }
  }

  return {
    opened,
    log: writeLogEntry,
    tee: (
      target: Writable,
      {source, stringWritesAreMessages = false}: {source?: string; stringWritesAreMessages?: boolean},
    ) => {
      const decoder = new StringDecoder('utf8')
      let pending = ''
      let currentSource = source
      const flushLines = async (text: string) => {
        const lines = text.split(/\r?\n/)
        pending = lines.pop() ?? ''
        await Promise.all(
          lines.map(async (line) => {
            const message = unstyled(line).trimEnd()
            if (message.length > 0) await writeLogEntry({source: currentSource, message})
          }),
        )
      }
      const flush = () => flushLines(`${pending}${decoder.end()}\n`)
      const output = new DevInstanceOutput({
        decodeStrings: !stringWritesAreMessages,
        write(chunk: Buffer | string, encoding, callback) {
          const nextSource = source === undefined ? undefined : (getConcurrentOutputContext()?.outputPrefix ?? source)
          const completeMessage = stringWritesAreMessages && typeof chunk === 'string'
          const previous = nextSource !== currentSource || completeMessage ? flush() : Promise.resolve()
          currentSource = nextSource
          Promise.all([
            previous,
            writeToStream(target, chunk, encoding),
            flushLines(
              pending +
                decoder.write(typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk) +
                (completeMessage ? '\n' : ''),
            ),
          ])
            .then(() => callback())
            .catch(callback)
        },
        final(callback) {
          flush()
            .then(() => callback())
            .catch(callback)
        },
      })
      const onTargetError = (error: Error) => output.destroy(error)
      target.on('error', onTargetError)
      output.on('error', (error) => onError(error))
      output.once('close', () => {
        target.off('error', onTargetError)
      })
      outputs.add(output)
      return output
    },
    flush: () => Promise.allSettled([...outputs].map((output) => endStream(output))),
    close: async () => {
      try {
        await endStream(logStream)
        if (logOutput && !logOutput.destroyed) await writeToStream(logOutput, '')
      } finally {
        logOutput?.off('error', onError)
      }
    },
  }
}

// Writable processes queued chunks in an earlier write's context. Capture context when each chunk is submitted.
class DevInstanceOutput extends Writable {
  private readonly contexts: (ConcurrentOutputContext | undefined)[] = []

  constructor(options: WritableOptions & {write: NonNullable<WritableOptions['write']>}) {
    super({
      ...options,
      write: (chunk, encoding, callback) => {
        useConcurrentOutputContext(this.contexts.shift() ?? {}, () =>
          options.write.call(this, chunk, encoding, callback),
        )
      },
    })
  }

  write(
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    this.contexts.push(getConcurrentOutputContext())
    return typeof encoding === 'string'
      ? super.write(chunk, encoding, callback)
      : super.write(chunk, encoding ?? callback)
  }

  end(
    chunk?: string | Uint8Array | null | (() => void),
    encoding?: BufferEncoding | (() => void),
    callback?: () => void,
  ): this {
    if (chunk !== undefined && chunk !== null && typeof chunk !== 'function')
      this.contexts.push(getConcurrentOutputContext())
    if (typeof chunk === 'function') return super.end(chunk)
    return typeof encoding === 'string' ? super.end(chunk, encoding, callback) : super.end(chunk, encoding ?? callback)
  }
}

async function writeToStream(stream: Writable, chunk: Buffer | string, encoding: BufferEncoding = 'utf8') {
  await new Promise<void>((resolve, reject) => {
    stream.write(chunk, encoding, (error) => (error ? reject(error) : resolve()))
  })
}

async function endStream(stream: Writable) {
  const completed = finished(stream, {cleanup: true})
  stream.end()
  await completed
}
