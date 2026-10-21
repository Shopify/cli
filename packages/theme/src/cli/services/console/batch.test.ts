import {evaluateConsoleInputs} from '../console.js'
import {
  fetchDevServerSession,
  initializeDevServerSession,
} from '../../utilities/theme-environment/dev-server-session.js'
import {render} from '../../utilities/theme-environment/storefront-renderer.js'
import {replLoop} from '../../utilities/repl/repl.js'
import {expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../utilities/theme-environment/dev-server-session.js')
vi.mock('../../utilities/theme-environment/storefront-renderer.js')
vi.mock('../../utilities/repl/repl.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utilities/repl/repl.js')>()),
  replLoop: vi.fn(),
}))

const options = {
  adminSession: {storeFqdn: 'shop.myshopify.com', token: 'token'},
  themeId: '123',
  url: '/',
}

function displayResponse(value: unknown): Response {
  return new Response(`<div>\n${JSON.stringify([{type: 'display', value}])}\n</div>`)
}

test('evaluates repeated inputs in order without starting a REPL or refresh timer', async () => {
  const session = {...options.adminSession, storefrontToken: 'token', sessionCookies: {}}
  vi.mocked(fetchDevServerSession).mockResolvedValue(session)
  vi.mocked(render).mockResolvedValueOnce(displayResponse('Shop')).mockResolvedValueOnce(displayResponse(false))

  const result = await evaluateConsoleInputs({...options, inputs: ['shop.name', 'false']})

  expect(result).toEqual({
    status: 'success',
    results: [
      {input: 'shop.name', status: 'success', value: 'Shop'},
      {input: 'false', status: 'success', value: false},
    ],
  })
  expect(fetchDevServerSession).toHaveBeenCalledWith('123', options.adminSession, undefined, undefined)
  expect(initializeDevServerSession).not.toHaveBeenCalled()
  expect(replLoop).not.toHaveBeenCalled()
})

test('waits for an assignment before evaluating expressions in the same session', async () => {
  let assignmentFinished = false
  vi.mocked(render)
    .mockResolvedValueOnce(new Response('<div>\nLiquid syntax error: Unexpected character\n</div>'))
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      assignmentFinished = true
      return new Response('<div>\n[{"type":"context","value":""}]\n</div>')
    })
    .mockImplementationOnce(async (_session, context) => {
      expect(assignmentFinished).toBe(true)
      expect(context.replaceTemplates?.['snippets/eval.liquid']).toContain('{% assign name = shop.name %}')
      return displayResponse('SHOP')
    })

  await expect(
    evaluateConsoleInputs({...options, inputs: ['assign name = shop.name', 'name | upcase']}),
  ).resolves.toEqual({
    status: 'success',
    results: [
      {input: 'assign name = shop.name', status: 'success', value: null},
      {input: 'name | upcase', status: 'success', value: 'SHOP'},
    ],
  })
  expect(render).toHaveBeenCalledTimes(3)
})

test('retains completed results, reports an error and skips dependent inputs', async () => {
  vi.mocked(render)
    .mockResolvedValueOnce(displayResponse('Shop'))
    .mockImplementation(async () => new Response("<div>\nLiquid syntax error: Unknown tag 'invalid'\n</div>"))

  await withCapturedStandardStreams(async (streams) => {
    await expect(
      evaluateConsoleInputs({...options, inputs: ['shop.name', 'invalid', 'shop.currency']}),
    ).resolves.toEqual({
      status: 'partial',
      results: [
        {input: 'shop.name', status: 'success', value: 'Shop'},
        {
          input: 'invalid',
          status: 'failed',
          error: {type: 'abort', message: "Unknown object, property, tag, or filter: 'invalid'"},
        },
        {input: 'shop.currency', status: 'skipped', reason: 'previous-input-failed'},
      ],
    })
    expect(streams.stdout()).toBe('')
    expect(streams.stderr()).toBe('')
  })
  expect(render).toHaveBeenCalledTimes(4)
})

test('reports invalid delimiters without making an evaluation request', async () => {
  const result = await evaluateConsoleInputs({...options, inputs: ['{{ shop.name }}', 'shop.currency']})
  expect(result.results[0]).toMatchObject({status: 'failed', error: {type: 'abort'}})
  expect(result.results[1]).toMatchObject({status: 'skipped'})
  expect(render).not.toHaveBeenCalled()
})

test('reports an evaluation transport failure and skips subsequent inputs', async () => {
  vi.mocked(render).mockRejectedValue(new AbortError('Session expired'))
  const result = await evaluateConsoleInputs({...options, inputs: ['shop.name', 'shop.currency']})
  expect(result.results).toEqual([
    {input: 'shop.name', status: 'failed', error: {type: 'abort', message: 'Session expired'}},
    {input: 'shop.currency', status: 'skipped', reason: 'previous-input-failed'},
  ])
})

test('propagates session setup failures', async () => {
  vi.mocked(fetchDevServerSession).mockRejectedValue(new AbortError('Cannot create a session'))
  await expect(evaluateConsoleInputs({...options, inputs: ['shop.name']})).rejects.toThrow('Cannot create a session')
  expect(render).not.toHaveBeenCalled()
})

test('reports Liquid objects that cannot be serialized as evaluation failures', async () => {
  vi.mocked(render).mockResolvedValue(displayResponse({error: 'json not allowed for this object'}))
  const result = await evaluateConsoleInputs({...options, inputs: ['product']})
  expect(result.results[0]).toMatchObject({
    status: 'failed',
    error: {type: 'abort', message: expect.stringContaining("Object can't be printed")},
  })
})

test('propagates unexpected errors instead of treating them as Liquid failures', async () => {
  vi.mocked(render).mockRejectedValue(new TypeError('Invalid response'))
  await expect(evaluateConsoleInputs({...options, inputs: ['shop.name']})).rejects.toThrow('Invalid response')
})

test('rejects Admin API tokens before creating the session', async () => {
  await expect(
    evaluateConsoleInputs({...options, inputs: ['shop.name'], themeAccessPassword: 'shpat_token'}),
  ).rejects.toThrow('Unable to use Admin API tokens with the console command')
  expect(fetchDevServerSession).not.toHaveBeenCalled()
})
