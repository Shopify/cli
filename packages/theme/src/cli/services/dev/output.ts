/* eslint-disable no-console -- Theme output helpers write messages through console.warn. */
import {renderCommandEvent, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {type DevInstance} from '@shopify/cli-kit/node/dev-instance'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {AsyncLocalStorage} from 'node:async_hooks'
import {Writable} from 'node:stream'
import {format} from 'node:util'

const themeDevOutput = new AsyncLocalStorage<Writable>()

export async function withThemeDevOutput<T>(instance: DevInstance, run: () => Promise<T>): Promise<T> {
  const output = instance.tee(new Writable({write: (_chunk, _encoding, next) => next()}), {
    stringWritesAreMessages: true,
  })
  const originalWarn = console.warn
  let active = true
  // Ink writes progress frames directly to stderr. Capture messages before presentation,
  // and record task events separately so screen redraws do not enter the session log.
  console.warn = captureWarn
  try {
    return await themeDevOutput.run(output, () =>
      useConcurrentOutputContext({consoleWarn: writeMessage}, () =>
        runWithCommandEvents(
          {
            outputMode: 'text',
            sink: (event, options) => {
              if (active && event.type === 'progress' && event.message) output.write(event.message)
              if (!options?.alreadyRendered) renderCommandEvent(event)
            },
          },
          run,
        ),
      ),
    )
  } finally {
    active = false
    restoreConsoleWarn()
  }

  function restoreConsoleWarn() {
    console.warn = originalWarn
  }

  function captureWarn(...args: unknown[]) {
    if (active && themeDevOutput.getStore() === output) {
      writeMessage(format(...args))
      return
    }
    originalWarn(...args)
  }

  function writeMessage(message: string) {
    if (active) output.write(message)
    // Ink can replace the console method while a progress view is active.
    const warn = console.warn === captureWarn ? originalWarn : console.warn
    warn(message)
  }
}
