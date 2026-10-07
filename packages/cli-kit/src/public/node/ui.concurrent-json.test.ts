import {renderConcurrent} from './ui.js'
import {runWithCommandEventsForCommand} from './command-events.js'
import {withCapturedStandardStreams} from './testing/output.js'
import {outputResult} from './output.js'
import {useConcurrentOutputContext} from '../../private/node/ui/components/ConcurrentOutput.js'
import {expect, test} from 'vitest'

function events(stderr: string) {
  return stderr
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('finite concurrent JSON output uses typed stderr events and leaves stdout for one result', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], async () => {
      await renderConcurrent({
        processes: [
          {
            prefix: 'web-backend',
            action: async (childStdout, childStderr) => {
              childStdout.write('build output\r\nsecond line\n\n')
              childStderr.write('build ')
              childStderr.write('diagnostic\r')
              childStderr.write('\n')
              const utf8 = Buffer.from('éclair\r\n')
              useConcurrentOutputContext({outputPrefix: 'unicode'}, () => childStderr.write(utf8.subarray(0, 1)))
              childStderr.write(utf8.subarray(1))
              useConcurrentOutputContext({outputPrefix: 'nested', stripAnsi: false}, () => {
                childStdout.write('\u001b[')
                childStdout.write('31mnested output\u001b[0m\n')
              })
              childStdout.write('final line')
            },
          },
        ],
        showTimestamps: false,
        renderOptions: {stdout: process.stdout},
      })
      outputResult('{"status":"success"}')
    })
    expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
    const sideEvents = events(stderr())
    expect(sideEvents.filter((event) => event.type === 'diagnostic').map((event) => event.message)).toStrictEqual([
      'web-backend: build output',
      'web-backend: second line',
      'web-backend: build diagnostic',
      'unicode: éclair',
      'nested: nested output',
      'web-backend: final line',
    ])
    expect(sideEvents.filter((event) => event.type === 'progress').map((event) => event.status)).toStrictEqual([
      'started',
      'completed',
    ])
    expect(stderr()).not.toContain('\u001b')
  })
})

test('concurrent JSON actions start together and receive the supplied abort signal', async () => {
  const controller = new AbortController()
  const started: number[] = []
  let complete!: () => void
  const ready = new Promise<void>((resolve) => {
    complete = resolve
  })
  await withCapturedStandardStreams(async ({stdout}) => {
    await runWithCommandEventsForCommand(['--json'], () =>
      renderConcurrent({
        abortSignal: controller.signal,
        processes: [1, 2].map((id) => ({
          prefix: String(id),
          action: async (_stdout, _stderr, signal) => {
            expect(signal).toBe(controller.signal)
            started.push(id)
            if (started.length === 2) complete()
            await ready
          },
        })),
      }),
    )
    expect(started).toStrictEqual([1, 2])
    expect(stdout()).toBe('')
  })
})

test('concurrent JSON rejects with the original failure and does not emit completion', async () => {
  const failure = new Error('build failed')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(
      runWithCommandEventsForCommand(['--json'], () =>
        renderConcurrent({
          processes: [
            {
              prefix: 'extension',
              action: async (_stdout, stderr) => {
                stderr.write('failure diagnostic')
                throw failure
              },
            },
          ],
        }),
      ),
    ).rejects.toBe(failure)
    expect(stdout()).toBe('')
    expect(events(stderr())).toContainEqual(
      expect.objectContaining({type: 'diagnostic', message: 'extension: failure diagnostic'}),
    )
    expect(
      events(stderr())
        .filter((event) => event.type === 'progress')
        .map((event) => event.status),
    ).toStrictEqual(['started', 'failed'])
  })
})

test('empty concurrent JSON work prints no progress or terminal output', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => renderConcurrent({processes: []}))
    expect(stdout()).toBe('')
    expect(stderr()).toBe('')
  })
})

test('the text concurrent renderer keeps child rows and does not encode side events', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand([], () =>
      renderConcurrent({
        processes: [
          {
            prefix: 'web',
            action: async (stream) => {
              stream.write('text build output\n')
            },
          },
        ],
        showTimestamps: false,
        renderOptions: {exitOnCtrlC: false, patchConsole: false},
      }),
    )
    expect(stdout()).toContain('text build output')
    expect(stderr()).not.toContain('"type":"diagnostic"')
  })
})
