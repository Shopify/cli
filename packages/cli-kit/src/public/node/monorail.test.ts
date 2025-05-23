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

  test('does not sanitize payload when no api_key exists', async () => {
    const outputMock = mockAndCaptureOutput()
    const res = await publishMonorailEvent('fake_schema/0.0', {command: 'test'}, {sensitive: 'data'})
    expect(res.type).toEqual('ok')
    const debugOutput = outputMock.debug()
    expect(debugOutput).toContain('"command": "test"')
    expect(debugOutput).toContain('"sensitive": "data"')
    // Check that api_key is not present in the current test's output
    const currentTestOutput = debugOutput.split('Analytics event sent:').slice(-1)[0]
    expect(currentTestOutput).not.toContain('api_key')
  })

  test('prevents duplicate command logging', async () => {
    const commandName = 'test-command'
    const publicData = {command: commandName, foo: 'bar'}
    const sensitiveData = {baz: 'abc'}

    // First call should succeed
    const res1 = await publishMonorailEvent('fake_schema/0.0', publicData, sensitiveData)
    expect(res1.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledTimes(1)

    // Second call with same command should return ok but not call fetch
    const res2 = await publishMonorailEvent('fake_schema/0.0', publicData, sensitiveData)
    expect(res2.type).toEqual('ok')
    // Still only called once
    expect(http.fetch).toHaveBeenCalledTimes(1)
  })

  test('allows duplicate logging when command is not a string', async () => {
    const publicData1 = {command: 123 as any, foo: 'bar'}
    const publicData2 = {command: 123 as any, foo: 'baz'}
    const sensitiveData = {sensitive: 'data'}

    const res1 = await publishMonorailEvent('fake_schema/0.0', publicData1, sensitiveData)
    expect(res1.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledTimes(1)

    const res2 = await publishMonorailEvent('fake_schema/0.0', publicData2, sensitiveData)
    expect(res2.type).toEqual('ok')
    // Called twice since command is not a string
    expect(http.fetch).toHaveBeenCalledTimes(2)
  })

  test('allows duplicate logging when command is missing', async () => {
    const publicData1 = {foo: 'bar'}
    const publicData2 = {foo: 'baz'}
    const sensitiveData = {sensitive: 'data'}

    const res1 = await publishMonorailEvent('fake_schema/0.0', publicData1, sensitiveData)
    expect(res1.type).toEqual('ok')
    expect(http.fetch).toHaveBeenCalledTimes(1)

    const res2 = await publishMonorailEvent('fake_schema/0.0', publicData2, sensitiveData)
    expect(res2.type).toEqual('ok')
    // Called twice since no command field
    expect(http.fetch).toHaveBeenCalledTimes(2)
  })

  test('handles fetch exceptions with Error instances', async () => {
    const error = new Error('Network failure')
    vi.mocked(http.fetch).mockReset().mockRejectedValue(error)
    const outputMock = mockAndCaptureOutput()

    const res = await publishMonorailEvent('fake_schema/0.0', {command: 'unique-test-1'}, {})
    expect(res.type).toEqual('error')
    if (res.type === 'error') {
      expect(res.message).toEqual('Failed to report usage analytics: Network failure')
    }
    expect(outputMock.debug()).toMatch('Failed to report usage analytics: Network failure')
  })

  test('handles fetch exceptions with non-Error instances', async () => {
    const nonErrorException = 'Something went wrong'
    vi.mocked(http.fetch).mockReset().mockRejectedValue(nonErrorException)
    const outputMock = mockAndCaptureOutput()

    const res = await publishMonorailEvent('fake_schema/0.0', {command: 'unique-test-2'}, {})
    expect(res.type).toEqual('error')
    if (res.type === 'error') {
      expect(res.message).toEqual('Failed to report usage analytics')
    }
    expect(outputMock.debug()).toMatch('Failed to report usage analytics')
  })

  test('handles null exceptions', async () => {
    vi.mocked(http.fetch).mockReset().mockRejectedValue(null)
    const outputMock = mockAndCaptureOutput()

    const res = await publishMonorailEvent('fake_schema/0.0', {command: 'unique-test-3'}, {})
    expect(res.type).toEqual('error')
    if (res.type === 'error') {
      expect(res.message).toEqual('Failed to report usage analytics')
    }
    expect(outputMock.debug()).toMatch('Failed to report usage analytics')
  })

  test('handles different HTTP status codes', async () => {
    vi.mocked(http.fetch)
      .mockReset()
      .mockResolvedValue({status: 404, statusText: 'Not Found'} as any)
    const outputMock = mockAndCaptureOutput()

    const res = await publishMonorailEvent('fake_schema/0.0', {command: 'unique-test-4'}, {})
    expect(res.type).toEqual('error')
    if (res.type === 'error') {
      expect(res.message).toEqual('Not Found')
    }
    expect(outputMock.debug()).toMatch('Failed to report usage analytics: Not Found')
  })
})
