import * as http from './http.js'
import {publishMonorailEvent} from './monorail.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./http.js')

describe('monorail', () => {
  const currentDate = new Date(Date.UTC(2022, 1, 1, 10, 0, 0))
  const expectedURL = 'https://monorail-edge.shopifysvc.com/v1/produce'
  const expectedHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': '1643709600000',
    'X-Monorail-Edge-Event-Sent-At-Ms': '1643709600000',
  }

  beforeEach(() => {
    vi.setSystemTime(currentDate)
    vi.mocked(http.fetch).mockResolvedValue({status: 200} as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows an error if the Monorail request fails', async () => {
    vi.mocked(http.fetch).mockResolvedValueOnce({status: 500, statusText: 'Monorail is down'} as any)
    const outputMock = mockAndCaptureOutput()
    const res = await publishMonorailEvent('fake_schema/0.0', {foo: 'bar'}, {})
    expect(res.type).toEqual('error')
    expect(outputMock.debug()).toMatch('Failed to report usage analytics: Monorail is down')
  })

  test('builds a request', async () => {
    const res = await publishMonorailEvent('fake_schema/0.0', {foo: 'bar'}, {baz: 'abc'})
    expect(res.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
      method: 'POST',
      body: JSON.stringify({schema_id: 'fake_schema/0.0', payload: {foo: 'bar', baz: 'abc'}}),
      headers: expectedHeaders,
    })
  })

  test('sanitizes the api_key from the debug log', async () => {
    const outputMock = mockAndCaptureOutput()
    const res = await publishMonorailEvent('fake_schema/0.0', {api_key: 'some-api-key'}, {baz: 'abc'})
    expect(res.type).toEqual('ok')
    expect(outputMock.debug()).toContain('"api_key": "****"')
    expect(outputMock.debug()).not.toContain('some-api-key')
  })
})
