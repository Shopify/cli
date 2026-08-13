import {authFixtures} from './fixtures.js'
import {createFixtureFetch} from './harness.js'
import {describe, expect, test} from 'vitest'
import type {AuthSignal} from '../index.js'
import type {AuthFixture} from './fixtures.js'

const signal: AuthSignal = {
  aborted: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}

async function requestFixture(
  fixture: AuthFixture,
  request: Omit<AuthFixture['request'], 'method'> & {method: string} = fixture.request,
  withSignal = false,
) {
  const fetch = createFixtureFetch(fixture)
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    ...(withSignal ? {signal} : {}),
  })
}

describe('createFixtureFetch', () => {
  test.each(authFixtures)('accepts the valid request for $name', async (fixture) => {
    await expect(
      requestFixture(fixture, fixture.request, fixture.signalExpectation === 'required'),
    ).resolves.toMatchObject({
      status: fixture.responses[0]?.status,
    })
  })

  test('rejects a wrong method', async () => {
    const fixture = authFixtures[0]!
    const request = {...fixture.request, method: 'GET'}
    await expect(requestFixture(fixture, request)).rejects.toThrow('method or URL')
  })

  test('rejects a wrong URL', async () => {
    const fixture = authFixtures[0]!
    const request: AuthFixture['request'] = {...fixture.request, url: `${fixture.request.url}/wrong`}
    await expect(requestFixture(fixture, request)).rejects.toThrow('method or URL')
  })

  test.each([
    ['missing', {}],
    ['extra', {'X-Fixture': 'unexpected'}],
    ['misvalued', {'Content-type': 'text/plain'}],
  ])('rejects a %s header', async (_description, headers) => {
    const fixture = authFixtures[0]!
    const request: AuthFixture['request'] = {...fixture.request, headers}
    await expect(requestFixture(fixture, request)).rejects.toThrow('headers or body')
  })

  test('rejects a reordered body', async () => {
    const fixture = authFixtures.find(({request}) => request.body.includes('&'))!
    const [first, second] = fixture.request.body.split('&')
    const reordered = `${second}&${first}`
    const request: AuthFixture['request'] = {...fixture.request, body: reordered}
    await expect(requestFixture(fixture, request)).rejects.toThrow('headers or body')
  })

  test('rejects an altered body value', async () => {
    const fixture = authFixtures[0]!
    const request: AuthFixture['request'] = {
      ...fixture.request,
      body: fixture.request.body.replace('fixture-client-id', 'other-client'),
    }
    await expect(requestFixture(fixture, request)).rejects.toThrow('headers or body')
  })

  test('requires a signal when the fixture requires one', async () => {
    const fixture = authFixtures.find(({signalExpectation}) => signalExpectation === 'required')!
    await expect(requestFixture(fixture)).rejects.toThrow('expected an abort signal')
  })

  test('rejects a signal when the fixture requires it to be absent', async () => {
    const fixture = authFixtures.find(({signalExpectation}) => signalExpectation === 'absent')!
    await expect(requestFixture(fixture, fixture.request, true)).rejects.toThrow('did not expect an abort signal')
  })

  test('permits either signal state for optional fixtures', async () => {
    const fixture = authFixtures.find(({signalExpectation}) => signalExpectation === 'optional')!
    await expect(requestFixture(fixture)).resolves.toBeDefined()
    await expect(requestFixture(fixture, fixture.request, true)).resolves.toBeDefined()
  })

  test('returns responses in fixture order', async () => {
    const fixture: AuthFixture = {
      ...authFixtures[0]!,
      name: 'ordered responses',
      responses: [
        {status: 202, body: 'first'},
        {status: 200, body: 'second'},
      ],
    }
    const fetch = createFixtureFetch(fixture)
    const init = {method: fixture.request.method, headers: fixture.request.headers, body: fixture.request.body}
    const first = await fetch(fixture.request.url, init)
    const second = await fetch(fixture.request.url, init)
    expect(first.status).toBe(202)
    expect(second.status).toBe(200)
  })

  test('rejects a fixture with no responses', async () => {
    const fixture: AuthFixture = {...authFixtures[0]!, name: 'empty responses', responses: []}
    const fetch = createFixtureFetch(fixture)
    await expect(requestFixture(fixture)).rejects.toThrow('fixture has no response')
  })

  test('rejects a response call after the sequence is exhausted', async () => {
    const fixture = authFixtures[0]!
    const fetch = createFixtureFetch(fixture)
    const init = {method: fixture.request.method, headers: fixture.request.headers, body: fixture.request.body}
    await fetch(fixture.request.url, init)
    await expect(fetch(fixture.request.url, init)).rejects.toThrow('response sequence exhausted')
  })
})
