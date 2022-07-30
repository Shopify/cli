/* eslint-disable @typescript-eslint/naming-convention */
import * as http from './http.js'
import {publishEvent} from './monorail.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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
    vi.mock('./http.js')
    vi.mocked(http.fetch).mockResolvedValue({status: 200} as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an error if the Monorail request fails', async () => {
    vi.mocked(http.fetch).mockResolvedValueOnce({status: 500, statusText: 'Monorail is down'} as any)
    const outputMock = mockAndCaptureOutput()
    const res = await publishEvent('fake_schema/0.0', {foo: 'bar'}, {})
    expect(res.type).toEqual('error')
    expect(outputMock.debug()).toMatch('Failed to report usage analytics: Monorail is down')
  })

  it('builds a request', async () => {
    const res = await publishEvent('fake_schema/0.0', {foo: 'bar'}, {baz: 'abc'})
    expect(res.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
      method: 'POST',
      body: JSON.stringify({schema_id: 'fake_schema/0.0', payload: {foo: 'bar', baz: 'abc'}}),
      headers: expectedHeaders,
    })
  })
})
