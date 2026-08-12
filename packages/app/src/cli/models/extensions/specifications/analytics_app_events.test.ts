import analyticsAppEventsSpec from './analytics_app_events.js'
import {describe, expect, test} from 'vitest'

describe('analytics_app_events', () => {
  test('reports when the extension has loaded', async () => {
    // When
    const messages = await analyticsAppEventsSpec.getDevSessionUpdateMessages!({})

    // Then
    expect(messages).toEqual(['Extension loaded'])
  })
})
