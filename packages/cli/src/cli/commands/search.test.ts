import Search from './search.js'
import * as searchServices from '../services/commands/search/index.js'
import {searchJsonOutputSchema} from '../services/commands/search/types.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {afterEach, describe, expect, test, vi, type MockInstance} from 'vitest'

vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

let searchService: MockInstance<typeof searchServices.searchService>
const queryURL = 'https://shopify.dev/docs?search=deploy+app'

describeJsonCommand({
  command: Search,
  commandId: 'search',
  moduleURL: import.meta.url,
  args: ['deploy app'],
  expectedResult: {url: queryURL},
  expectedSchema: {
    type: 'object',
    properties: {url: {type: 'string', format: 'uri'}},
    required: ['url'],
  },
  setup: () => {
    searchService = vi.spyOn(searchServices, 'searchService')
    return () => searchService.mockRestore()
  },
  assertExecuted: (format) => {
    expect(searchService).toHaveBeenCalledExactlyOnceWith('deploy app')
    if (format === 'text') expect(openURL).toHaveBeenCalledExactlyOnceWith(queryURL)
    else expect(openURL).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(searchService).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
  },
  textOutput: {stdout: '', stderr: ''},
})

describe('search command', () => {
  test.each(['deploy app', ''])('opens the browser without printing a result in text mode for %j', async (query) => {
    const output = mockAndCaptureOutput()
    const url = query ? queryURL : 'https://shopify.dev/docs?search='

    await Search.run(query ? [query] : [], import.meta.url)

    expect(openURL).toHaveBeenCalledWith(url)
    expect(output.output()).toBe('')
    expect(output.warn()).toBe('')
  })

  test('prints the empty search URL without opening the browser in JSON mode', async () => {
    vi.stubEnv('CI', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await Search.run(['--json'], import.meta.url)

      expect(stdout()).toBe(`${JSON.stringify({url: 'https://shopify.dev/docs?search='}, null, 2)}\n`)
      expect(stderr()).toBe('')
    })
    expect(openURL).not.toHaveBeenCalled()
  })

  test.each([{}, {url: 123}, {url: 'not a URL'}])('rejects an invalid result: %j', (result) => {
    expect(() => searchJsonOutputSchema.validate(result)).toThrow()
  })
})
