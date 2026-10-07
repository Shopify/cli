import {renderAutocompletePrompt} from './ui.js'
import {runWithCommandEventsForCommand} from './command-events.js'
import {outputInfo, outputResult, unstyled} from './output.js'
import {withCapturedStandardStreams} from './testing/output.js'
import {defineJsonOutputSchema} from './json-output-schema.js'
import {zod} from './schema.js'
import {terminalSupportsPrompting} from './system.js'
import {AbortError} from './error.js'
import {Stdin} from '../../private/node/testing/ui.js'
import {expect, test, vi} from 'vitest'

const choices = [
  {label: 'Store A', value: 'store-a'},
  {label: 'Store B', value: 'store-b'},
]
const resultSchema = defineJsonOutputSchema({
  name: 'PromptSelectionResult',
  schema: zod.object({selected: zod.string()}).strict(),
})

// Keep the real stream writers. Only terminal attributes and the controlled input are fixtures.
async function withTerminal<T>(run: (input: Stdin) => Promise<T>, stdoutIsTTY = true): Promise<T> {
  const input = new Stdin()
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin')
  Object.defineProperty(process, 'stdin', {configurable: true, value: input})
  const objects = [process.stdout, process.stderr, input]
  const descriptors = objects.map(
    (object) => new Map(['isTTY', 'columns', 'rows'].map((key) => [key, Object.getOwnPropertyDescriptor(object, key)])),
  )
  objects.forEach((object) => {
    Object.defineProperty(object, 'isTTY', {configurable: true, value: object === process.stdout ? stdoutIsTTY : true})
    Object.defineProperty(object, 'columns', {configurable: true, value: 80})
    Object.defineProperty(object, 'rows', {configurable: true, value: 40})
  })
  vi.stubEnv('CI', '0')
  vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '0')
  try {
    return await run(input)
  } finally {
    objects.forEach((object, index) => {
      for (const [key, descriptor] of descriptors[index]!) {
        if (descriptor) Object.defineProperty(object, key, descriptor)
        else Reflect.deleteProperty(object, key)
      }
    })
    if (stdinDescriptor) Object.defineProperty(process, 'stdin', stdinDescriptor)
    else Reflect.deleteProperty(process, 'stdin')
    vi.unstubAllEnvs()
  }
}

async function waitForPrompt(input: Stdin, text: () => string): Promise<void> {
  await vi.waitFor(
    () => {
      expect(unstyled(text())).toContain('Which store?')
      expect(input.listenerCount('readable')).toBeGreaterThan(0)
    },
    {timeout: 2000, interval: 10},
  )
  await new Promise<void>((resolve) => setImmediate(resolve))
}

test.each([false, true])(
  'autocomplete uses the terminal UI stream with redirected JSON stdout: json=%s',
  async (json) => {
    await withTerminal(async (input) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runWithCommandEventsForCommand(json ? ['--json'] : [], async () => {
          expect(process.stdout.isTTY).toBe(!json)
          expect(terminalSupportsPrompting()).toBe(true)
          const pending = renderAutocompletePrompt({
            message: 'Which store?',
            choices,
            renderOptions: {debug: true, patchConsole: false},
          })
          await waitForPrompt(input, () => stdout() + stderr())
          input.write('\r')
          const selected = await pending
          expect(selected).toBe('store-a')
          outputInfo('Selection complete')
          outputResult(resultSchema.encode({selected}))
        })
        if (json) {
          expect(JSON.parse(stdout())).toStrictEqual({selected: 'store-a'})
          expect(unstyled(stderr())).toContain('Which store?')
          expect(stderr()).toContain('"type":"diagnostic"')
          // Interactive UI is human text on stderr; this is deliberately not a pure-event assertion.
        } else {
          expect(unstyled(stdout())).toContain('Which store?')
          expect(stderr()).not.toContain('Which store?')
        }
      })
    }, !json)
  },
)

test('appropriate explicit text rendering options still select stderr', async () => {
  await withTerminal(async (input) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand([], async () => {
        const pending = renderAutocompletePrompt({
          message: 'Which store?',
          choices,
          renderOptions: {
            stdout: process.stderr,
            debug: true,
            patchConsole: false,
          },
        })
        await waitForPrompt(input, stderr)
        input.write('\r')
        await expect(pending).resolves.toBe('store-a')
      })
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('Which store?')
    })
  }, false)
})

test.each([false, true])('no-input rejects before rendering even with JSON: json=%s', async (json) => {
  await withTerminal(async () => {
    expect(terminalSupportsPrompting()).toBe(true)
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    expect(terminalSupportsPrompting()).toBe(false)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(
        runWithCommandEventsForCommand(json ? ['--json', '--no-input'] : ['--no-input'], () =>
          renderAutocompletePrompt({message: 'Which store?', choices}),
        ),
      ).rejects.toBeInstanceOf(AbortError)
      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })
  })
})

test('JSON prompt cancellation retains the supplied abort reason and writes no result', async () => {
  await withTerminal(async () => {
    const input = new Stdin()
    const controller = new AbortController()
    const reason = new Error('Harmless fixture cancellation')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const pending = renderAutocompletePrompt({
          message: 'Which store?',
          choices,
          abortSignal: controller.signal,
          renderOptions: {stdin: input as unknown as NodeJS.ReadStream, debug: true, patchConsole: false},
        })
        const rejected = expect(pending).rejects.toBe(reason)
        await waitForPrompt(input, stderr)
        controller.abort(reason)
        await rejected
      })
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('Which store?')
    })
  })
})
