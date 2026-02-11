import {outputResult} from '@shopify/cli-kit/node/output'

export type OutputFormat = 'text' | 'json' | 'csv' | 'md'

interface OutputHandler {
  onChunk(chunk: string): void
  onEnd(): void
}

export function createOutputHandler(format: OutputFormat): OutputHandler {
  if (format === 'json' || format === 'csv') {
    const buffer: string[] = []
    return {
      onChunk(chunk: string) {
        buffer.push(chunk)
      },
      onEnd() {
        const content = buffer.join('')
        if (format === 'json') {
          try {
            const parsed = JSON.parse(content)
            outputResult(JSON.stringify(parsed, null, 2))
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch {
            outputResult(content)
          }
        } else {
          outputResult(content)
        }
      },
    }
  }

  // text and md: stream directly
  return {
    onChunk(chunk: string) {
      process.stdout.write(chunk)
    },
    onEnd() {
      process.stdout.write('\n')
    },
  }
}
