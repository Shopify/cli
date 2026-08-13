import type {AuthFetch, AuthFetchResponse} from '../index.js'
import type {AuthFixture, AuthSignal} from './fixtures.js'

/** Creates a transport double from a fixture without requiring a runtime or HTTP library. */
export function createFixtureFetch(fixture: AuthFixture): AuthFetch {
  let responseIndex = 0
  return async (url, init: Parameters<AuthFetch>[1] & {signal?: AuthSignal}): Promise<AuthFetchResponse> => {
    if (url !== fixture.request.url || init.method !== fixture.request.method) {
      throw new Error(`${fixture.name}: request method or URL did not match the fixture`)
    }
    if (!sameRecord(init.headers, fixture.request.headers) || init.body !== fixture.request.body) {
      throw new Error(`${fixture.name}: request headers or body did not match the fixture`)
    }
    const signalState = init.signal ? 'present' : 'absent'
    if (fixture.signalExpectation === 'required' && signalState !== 'present') {
      throw new Error(`${fixture.name}: expected an abort signal`)
    }
    if (fixture.signalExpectation === 'absent' && signalState !== 'absent') {
      throw new Error(`${fixture.name}: did not expect an abort signal`)
    }
    if (fixture.responses.length === 0) throw new Error(`${fixture.name}: fixture has no response`)
    if (responseIndex >= fixture.responses.length) {
      throw new Error(`${fixture.name}: response sequence exhausted after ${fixture.responses.length} response(s)`)
    }
    const response = fixture.responses[responseIndex++]
    if (!response) throw new Error(`${fixture.name}: fixture has no response`)
    return {
      status: response.status,
      text: async () => response.body,
    }
  }
}

/** Runs a fixture transport and returns the observed response; adapters map it to fixture.expected. */
export async function runFixtureTransport(
  fixture: AuthFixture,
  request: (fetch: AuthFetch, signal?: AuthSignal) => Promise<unknown>,
): Promise<unknown> {
  return request(createFixtureFetch(fixture))
}

function sameRecord(actual: Record<string, string>, expected: Record<string, string>): boolean {
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actual[key] === expected[key])
}
