import {commandEventOutputSchema} from '../../../public/node/command-events.js'
import {expect} from 'vitest'

export type CommandEventExpectation = Record<string, unknown>[] | ((events: Record<string, unknown>[]) => void)

export function expectCommandEvents(stderr: string, expectedEvents: CommandEventExpectation): void {
  const events = stderr.trim()
    ? stderr
        .trim()
        .split('\n')
        .map((line) => commandEventOutputSchema.validate(JSON.parse(line)))
    : []
  if (typeof expectedEvents === 'function') {
    expectedEvents(events)
  } else {
    expect(events).toMatchObject(expectedEvents)
  }
}
