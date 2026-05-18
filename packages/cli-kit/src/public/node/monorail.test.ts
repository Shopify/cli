import * as http from './http.js'
import {MONORAIL_COMMAND_TOPIC, publishMonorailEvent} from './monorail.js'
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
    expect(http.fetch).toHaveBeenCalledWith(
      expectedURL,
      {
        method: 'POST',
        body: JSON.stringify({schema_id: 'fake_schema/0.0', payload: {foo: 'bar', baz: 'abc'}}),
        headers: expectedHeaders,
      },
      'non-blocking',
    )
  })

  test('sanitizes the api_key from the debug log', async () => {
    const outputMock = mockAndCaptureOutput()
    const res = await publishMonorailEvent('fake_schema/0.0', {api_key: 'some-api-key'}, {baz: 'abc'})
    expect(res.type).toEqual('ok')
    expect(outputMock.debug()).toContain('"api_key": "****"')
    expect(outputMock.debug()).not.toContain('some-api-key')
  })

  test('builds a request for the real command topic including validated store attribution', async () => {
    const res = await publishMonorailEvent(
      MONORAIL_COMMAND_TOPIC,
      {
        command: 'shopify store auth',
        time_start: 1643709600000,
        time_end: 1643709601000,
        total_time: 1000,
        success: true,
        cli_version: '3.94.0',
        uname: 'Darwin test',
        ruby_version: '3.3.0',
        node_version: '22.0.0',
        is_employee: false,
        user_id: '42',
        store_fqdn_hash: 'hashed-store',
        store_fqdn_validated: true,
        shop_domain: 'shop.myshopify.com',
      },
      {
        args: '--store shop.myshopify.com',
        store_fqdn: 'shop.myshopify.com',
      },
    )

    expect(res.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledWith(
      expectedURL,
      {
        method: 'POST',
        body: JSON.stringify({
          schema_id: MONORAIL_COMMAND_TOPIC,
          payload: {
            command: 'shopify store auth',
            time_start: 1643709600000,
            time_end: 1643709601000,
            total_time: 1000,
            success: true,
            cli_version: '3.94.0',
            uname: 'Darwin test',
            ruby_version: '3.3.0',
            node_version: '22.0.0',
            is_employee: false,
            user_id: '42',
            store_fqdn_hash: 'hashed-store',
            store_fqdn_validated: true,
            shop_domain: 'shop.myshopify.com',
            args: '--store shop.myshopify.com',
            store_fqdn: 'shop.myshopify.com',
          },
        }),
        headers: expectedHeaders,
      },
      'non-blocking',
    )
  })
})
