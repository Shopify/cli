import {languageServerJsonOutputSchema} from './types.js'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {expect, test} from 'vitest'

test.each([
  {jsonrpc: '2.0', id: 'configuration-1', method: 'workspace/configuration', params: {items: [{section: 'theme'}]}},
  {jsonrpc: '2.0', id: 0, method: 'shutdown'},
  {jsonrpc: '2.0', id: -2147483648, method: 'example', params: [null, true, 1, 'value']},
  {jsonrpc: '2.0', method: 'exit'},
  {jsonrpc: '2.0', method: '$/cancelRequest', params: {id: 'hover-3'}},
  {jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: {uri: 'file:///theme.liquid', diagnostics: []}},
  {jsonrpc: '2.0', id: 2147483647, result: {capabilities: {}, serverInfo: {name: 'Thème server'}}},
  {jsonrpc: '2.0', id: 2, result: null},
  {jsonrpc: '2.0', id: null, result: [false, 0, 'value', {nested: [null]}]},
  {jsonrpc: '2.0', id: 'hover-3', result: 'value'},
  {jsonrpc: '2.0', id: 2, error: {code: -32601, message: 'Method not found'}},
  {jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error', data: {details: [null, 1]}}},
])('validates native LSP message bodies: %j', (message) => {
  expect(languageServerJsonOutputSchema.validate(message)).toEqual(message)
  expect(jsonSchemaValidate(message, languageServerJsonOutputSchema.jsonSchema, 'fail', 'lsp-message').state).toBe('ok')
})

test.each([
  {},
  {id: 2, result: null},
  {jsonrpc: '1.0', id: 2, result: null},
  {jsonrpc: '2.0', id: 2},
  {jsonrpc: '2.0', result: null},
  {jsonrpc: '2.0', id: 2, result: null, error: {code: -32601, message: 'Method not found'}},
  {jsonrpc: '2.0', id: true, result: null},
  {jsonrpc: '2.0', id: 1.5, result: null},
  {jsonrpc: '2.0', id: 2147483648, result: null},
  {jsonrpc: '2.0', id: -2147483649, result: null},
  {jsonrpc: '2.0', id: null, method: 'shutdown'},
  {jsonrpc: '2.0', method: 42},
  {jsonrpc: '2.0', method: 'example', params: null},
  {jsonrpc: '2.0', method: 'example', params: 'value'},
  {jsonrpc: '2.0', method: 'example', result: null},
  {jsonrpc: '2.0', id: 2, error: {message: 'Missing code'}},
  {jsonrpc: '2.0', id: 2, error: {code: -32601}},
  {jsonrpc: '2.0', id: 2, error: {code: 1.5, message: 'Invalid code'}},
  {jsonrpc: '2.0', id: 2, result: null, extra: true},
])('rejects invalid LSP message bodies: %j', (message) => {
  expect(() => languageServerJsonOutputSchema.validate(message)).toThrow()
})

test('requires response IDs and separate success and error payloads in the published schema', () => {
  const {definitions} = languageServerJsonOutputSchema.jsonSchema
  expect(definitions).toMatchObject({
    LspSuccessResponse: {required: ['jsonrpc', 'id', 'result'], additionalProperties: false},
    LspErrorResponse: {required: ['jsonrpc', 'id', 'error'], additionalProperties: false},
    LspNotification: {required: ['jsonrpc', 'method'], additionalProperties: false},
  })
})

test.each([undefined, () => {}, Number.POSITIVE_INFINITY, {nested: undefined}])(
  'rejects non-JSON response values: %j',
  (result) => {
    expect(() => languageServerJsonOutputSchema.validate({jsonrpc: '2.0', id: 2, result})).toThrow()
  },
)
