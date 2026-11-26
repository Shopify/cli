import {App, ExtensionPayload, Status, UpdatePersistPayload} from './types'

describe('Status', () => {
  test('lists every build status that the extension server sends', () => {
    expect(Object.values(Status)).toStrictEqual(['success', 'error', ''])
  })
})

// The build's `tsc` checks these assertions; Vitest does not.
describe('UpdatePersistPayload', () => {
  test('accepts a partial app update that names the app', () => {
    expectTypeOf<{app: {apiKey: string; title: string}}>().toExtend<UpdatePersistPayload>()
  })

  test('rejects an app update without the API key, which the server ignores', () => {
    expectTypeOf<{app: {title: string}}>().not.toExtend<UpdatePersistPayload>()
  })

  test('accepts a partial extension update that names the extension', () => {
    expectTypeOf<{extensions: [{uuid: string; version: string}]}>().toExtend<UpdatePersistPayload>()
    expectTypeOf<{extensions: [{version: string}]}>().not.toExtend<UpdatePersistPayload>()
  })

  test('accepts a partial extension point update that names the target', () => {
    expectTypeOf<{
      extensions: [{uuid: string; extensionPoints: [{target: string; resource: {url: string}}]}]
    }>().toExtend<UpdatePersistPayload>()
    expectTypeOf<{
      extensions: [{uuid: string; extensionPoints: [{resource: {url: string}}]}]
    }>().not.toExtend<UpdatePersistPayload>()
  })

  test('accepts whole extension payloads and a whole app', () => {
    expectTypeOf<{app: App; extensions: ExtensionPayload[]}>().toExtend<UpdatePersistPayload>()
  })

  test('accepts the string and null forms of extension points', () => {
    expectTypeOf<{extensions: [{uuid: string; extensionPoints: string[]}]}>().toExtend<UpdatePersistPayload>()
    expectTypeOf<{extensions: [{uuid: string; extensionPoints: null}]}>().toExtend<UpdatePersistPayload>()
  })
})
