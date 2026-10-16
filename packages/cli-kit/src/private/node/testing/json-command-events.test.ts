import {expectCommandEvents} from './json-command-events.js'
import {withCapturedStandardStreams} from '../../../public/node/testing/output.js'
import {runWithCommandEventsForCommand} from '../../../public/node/command-events.js'
import {outputInfo} from '../../../public/node/output.js'
import {expect, test, vi} from 'vitest'

test('rejects malformed native console events before running a custom assertion', async () => {
  const assertion = vi.fn((events: Record<string, unknown>[]) => {
    expect(events.every((event) => event.type === 'progress')).toBe(true)
  })
  await withCapturedStandardStreams(async ({stderr}) => {
    // eslint-disable-next-line no-console
    console.error('{"type":"progress"}')
    expect(() => expectCommandEvents(stderr(), assertion)).toThrow()
    expect(assertion).not.toHaveBeenCalled()
  })
})

test('checks a valid captured diagnostic with a custom assertion', async () => {
  const assertion = vi.fn((events: Record<string, unknown>[]) => {
    expect(events).toEqual([
      expect.objectContaining({type: 'diagnostic', level: 'info', message: 'Captured command diagnostic'}),
    ])
  })
  await withCapturedStandardStreams(async ({stderr}) => {
    runWithCommandEventsForCommand(['--json'], () => outputInfo('Captured command diagnostic'))
    expectCommandEvents(stderr(), assertion)
    expect(assertion).toHaveBeenCalledOnce()
  })
})
