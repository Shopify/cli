import {downloadFile, shopifyFetch, formData, requestMode, fetch} from './http.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {fileExists, inTemporaryDirectory, readFile} from './fs.js'
import {joinPath} from './path.js'
import {getAllPublicMetadata} from './metadata.js'
import {platformAndArch} from './os.js'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {setupServer} from 'msw/node'
import {delay, http, HttpResponse} from 'msw'
import FormData from 'form-data'

const DURATION_UNTIL_ABORT_IS_SEEN = 100

const mockResponse = {hello: 'world!'}

const handlers = [
  http.get('https://shopify.example/working', () => {
    return HttpResponse.json(mockResponse)
  }),
  http.get('https://shopify.example/a-slow-endpoint', async () => {
    await delay(500)
    return HttpResponse.json(mockResponse)
  }),
  http.get('https://shopify.example/a-blocked-endpoint', async () => {
    await delay('infinite')
    return HttpResponse.json(mockResponse)
  }),
  http.get('https://shopify.example/example.txt', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('Hello '))
        controller.enqueue(encoder.encode('world'))
        controller.close()
      },
    })
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }),
  http.get('https://shopify.example/fails-to-download.txt', async () => {
    return HttpResponse.error()
  }),
]

// set up the server & clean-up
const server = setupServer(...handlers)
beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
})

// set-up fake timers & clean-up
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formData', () => {
  test('make an empty form data object', () => {
    const res = formData()
    expect(res).toBeInstanceOf(FormData)
    expect(res.getLengthSync()).toBe(0)
  })
})

describe('shopifyFetch', () => {
  test('make a successful request', async () => {
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    const response = shopifyFetch(`https://shopify.example/working?token=secret`)
    await vi.runAllTimersAsync()
    await expect(response).resolves.toBeDefined()

    const realResponse = await response

    expect(realResponse.status).toBe(200)
    await expect(realResponse.json()).resolves.toEqual(mockResponse)

    // NB: snapshot is not an option as the output is dynamic due to the completion time; fake timers don't cover performance.now()
    expect(mockOutput.debug()).toContain(`Sending GET request to URL https://shopify.example/working?token=****`)
    expect(mockOutput.debug()).toContain(`Request to https://shopify.example/working?token=**** completed in `)

    const metadata = getAllPublicMetadata()
    expect(metadata.cmd_all_timing_network_ms).toBeGreaterThan(0)
  })

  test('sets an abort signal by default', async () => {
    const failing = shopifyFetch(`https://shopify.example/a-slow-endpoint`, undefined, {
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: DURATION_UNTIL_ABORT_IS_SEEN,
    })
    await vi.advanceTimersByTimeAsync(DURATION_UNTIL_ABORT_IS_SEEN)

    await expect(failing).rejects.toThrow('The operation was aborted.')
  })

  test('abort signal is seen as a retryable error', async () => {
    // this test is complex with faked timers as we have the abort signal, the delay in response, and the retry logic
    // all competing to run at the same time. so: we use real timers and some adjusted limits -- the test takes 500ms.
    vi.useRealTimers()

    const requests: string[] = []
    server.events.on('request:start', ({request}) => {
      requests.push(request.url)
    })

    // the limit is 1100ms, which is enough for two retries plus maximum slack (e.g. running in a slow environment)
    const failingWithRetry = shopifyFetch(`https://shopify.example/a-blocked-endpoint`, undefined, {
      useNetworkLevelRetry: true,
      maxRetryTimeMs: 1100,
      useAbortSignal: true,
      timeoutMs: DURATION_UNTIL_ABORT_IS_SEEN,
    })
    await expect(failingWithRetry).rejects.toThrow('The operation was aborted.')

    // we have enough time for two requests in our 500ms allowance:
    // - we make a request
    // - we give it 100ms before the abort signal is seen
    // - we wait 300ms before a retry
    // - we retry the request
    // - there's 100ms before the abort signal is seen
    // - the next delay would be 600ms
    // - the next delay would take us over our 1100ms allowance, so retries are stopped
    expect(requests).toEqual([
      'https://shopify.example/a-blocked-endpoint',
      'https://shopify.example/a-blocked-endpoint',
    ])
  })

  test('provide an abort signal through a factory function', async () => {
    const signalFn = () => AbortSignal.timeout(DURATION_UNTIL_ABORT_IS_SEEN)
    const response = shopifyFetch(`https://shopify.example/a-slow-endpoint`, undefined, {
      useNetworkLevelRetry: false,
      useAbortSignal: signalFn,
    })
    await vi.advanceTimersByTimeAsync(DURATION_UNTIL_ABORT_IS_SEEN)

    await expect(response).rejects.toThrow('The operation was aborted.')
  })

  test('provide a hard-coded abort signal', async () => {
    const signalFn = AbortSignal.timeout(DURATION_UNTIL_ABORT_IS_SEEN)
    const response = shopifyFetch(`https://shopify.example/a-slow-endpoint`, undefined, {
      useNetworkLevelRetry: false,
      useAbortSignal: signalFn,
    })
    await vi.advanceTimersByTimeAsync(DURATION_UNTIL_ABORT_IS_SEEN)

    await expect(response).rejects.toThrow('The operation was aborted.')
  })

  test('provide an abort signal through request init option', async () => {
    const signalFn = AbortSignal.timeout(DURATION_UNTIL_ABORT_IS_SEEN)
    const response = shopifyFetch(
      `https://shopify.example/a-slow-endpoint`,
      {
        signal: signalFn,
      },
      {
        useNetworkLevelRetry: false,
        useAbortSignal: false,
      },
    )
    await vi.advanceTimersByTimeAsync(DURATION_UNTIL_ABORT_IS_SEEN)

    await expect(response).rejects.toThrow('The operation was aborted.')
  })
})

describe('fetch', () => {
  test('make a successful request', async () => {
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    const response = fetch(`https://shopify.example/working?token=secret`)
    await vi.runAllTimersAsync()
    await expect(response).resolves.toBeDefined()

    const realResponse = await response

    expect(realResponse.status).toBe(200)
    await expect(realResponse.json()).resolves.toEqual(mockResponse)

    // plain fetch doesn't have the same debug output
    expect(mockOutput.debug()).not.toContain(`Sending GET request to URL https://shopify.example/working`)
    expect(mockOutput.debug()).toContain(`Request to https://shopify.example/working?token=**** completed in `)

    const metadata = getAllPublicMetadata()
    expect(metadata.cmd_all_timing_network_ms).toBeGreaterThan(0)
  })

  test('no abort signal by default', async () => {
    const completes = fetch(`https://shopify.example/a-slow-endpoint`)

    // unlike shopifyFetch, the abort signal won't interrupt the request
    await vi.advanceTimersByTimeAsync(500)

    await expect(completes).resolves.toBeDefined()
  })
})

describe('downloadFile', () => {
  test('Downloads a file from a URL to a local path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const url = 'https://shopify.example/example.txt'
      const filename = '/bin/example.txt'
      const to = joinPath(tmpDir, filename)

      // When
      const result = await downloadFile(url, to)
      const exists = await fileExists(result)
      const contents = await readFile(result)

      // Then
      expect(result).toBe(to)
      expect(exists).toBe(true)
      expect(contents).toBe('Hello world')
    })
  })

  const runningOnWindows = platformAndArch().platform === 'windows'

  test.skipIf(runningOnWindows)('Cleans up if download fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const url = 'https://shopify.example/fails-to-download.txt'
      const filename = '/bin/fails-to-download.txt'
      const to = joinPath(tmpDir, filename)

      // When
      const result = downloadFile(url, to)

      await expect(result).rejects.toThrow('Network error')

      // no file if download fails
      await expect(fileExists(to)).resolves.toBe(false)
    })
  })
})

describe('requestMode', () => {
  const mockedEnv = {
    SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS: DURATION_UNTIL_ABORT_IS_SEEN.toString(),
    SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY: 'false',
  }

  test('no preference uses default', () => {
    const expected = {
      useNetworkLevelRetry: true,
      useAbortSignal: true,
      timeoutMs: 100,
      maxRetryTimeMs: 10000,
    }
    expect(requestMode(undefined, mockedEnv)).toEqual(expected)
    expect(requestMode('default', mockedEnv)).toEqual(expected)
  })

  test('non-blocking requests', () => {
    expect(requestMode('non-blocking', mockedEnv)).toEqual({
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: 100,
    })
  })

  test('slow-request requests', () => {
    expect(requestMode('slow-request', mockedEnv)).toEqual({
      useNetworkLevelRetry: false,
      useAbortSignal: false,
    })
  })

  test('default, with networkLevelRetry disabled', () => {
    expect(
      requestMode('default', {
        ...mockedEnv,
        SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY: 'true',
      }),
    ).toMatchObject({
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: 100,
    })
  })

  test('custom behaviour', () => {
    expect(
      requestMode({
        useNetworkLevelRetry: false,
        useAbortSignal: true,
        timeoutMs: 100,
      }),
    ).toEqual({
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: 100,
    })
  })

  test('custom behaviour, with networkLevelRetry disabled', () => {
    expect(
      requestMode(
        {
          useNetworkLevelRetry: true,
          maxRetryTimeMs: 10000,
          useAbortSignal: true,
          timeoutMs: 100,
        },
        {
          ...mockedEnv,
          SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY: 'true',
        },
      ),
    ).toMatchObject({
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: 100,
    })
  })
})
