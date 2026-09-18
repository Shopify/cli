import {
  AppDoctorReviewBindingError,
  MAX_TOKEN_LENGTH,
  decodeAppDoctorReviewBinding,
  encodeAppDoctorReviewBinding,
} from '../review/binding.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorReviewBinding} from '../review/binding.js'

const HEX = 'a'.repeat(64)

const binding: AppDoctorReviewBinding = {
  version: 1,
  configuration_identity: '1'.repeat(32),
  scope_identity: `sha256:${HEX}`,
  scope: {
    descriptor_version: 1,
    app_directory: {base: 'storage_anchor', up: 0, path: 'packages/app'},
    selected_config: {base: 'storage_anchor', up: 0, path: 'packages/app/shopify.app.toml'},
    directory: {base: 'storage_anchor', up: 0, path: 'packages/app/web'},
    boundary: {app: 'inside', anchor: 'inside'},
    exclusions: {semantics: 'literal-file-or-subtree-v1', declared_from: 'selected_config_directory', entries: []},
  },
  checks: [
    {id: 'A_CHECK', version: 1, prompt_hash: `sha256:${HEX}`},
    {id: 'B_CHECK', version: 2, prompt_hash: `sha256:${'b'.repeat(64)}`},
  ],
  engine: {name: 'shopify-app-doctor', version: '3.0.0'},
}

const encodePayload = (value: unknown) => `adr1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`

function expectBindingError(token: unknown, code: AppDoctorReviewBindingError['code']) {
  const decode = () => decodeAppDoctorReviewBinding(token)
  expect(decode).toThrow(AppDoctorReviewBindingError)
  expect(decode).toThrow(expect.objectContaining({code}))
  expect(decode).toThrow('shopify app doctor instructions')
}

describe('encodeAppDoctorReviewBinding', () => {
  test('produces an adr1 token that decodes to the same binding', () => {
    const token = encodeAppDoctorReviewBinding(binding)

    expect(token).toMatch(/^adr1\.[A-Za-z0-9_-]+$/)
    expect(decodeAppDoctorReviewBinding(token)).toEqual(binding)
  })

  test('is canonical: key order does not change the token', () => {
    const reordered = {
      engine: binding.engine,
      checks: binding.checks.map((check) => ({prompt_hash: check.prompt_hash, version: check.version, id: check.id})),
      scope: binding.scope,
      scope_identity: binding.scope_identity,
      configuration_identity: binding.configuration_identity,
      version: 1,
    } as AppDoctorReviewBinding

    expect(encodeAppDoctorReviewBinding(reordered)).toBe(encodeAppDoctorReviewBinding(binding))
  })

  test('differs when any bound value differs', () => {
    const otherScope = encodeAppDoctorReviewBinding({...binding, scope_identity: `sha256:${'c'.repeat(64)}`})
    const otherPrompt = encodeAppDoctorReviewBinding({
      ...binding,
      checks: [{...binding.checks[0]!, prompt_hash: `sha256:${'d'.repeat(64)}`}, binding.checks[1]!],
    })

    expect(new Set([encodeAppDoctorReviewBinding(binding), otherScope, otherPrompt]).size).toBe(3)
  })
})

describe('decodeAppDoctorReviewBinding', () => {
  test('rejects non-strings and wrong prefixes as malformed', () => {
    expectBindingError(undefined, 'malformed')
    expectBindingError(42, 'malformed')
    expectBindingError('', 'malformed')
    expectBindingError('adr1', 'malformed')
    expectBindingError('nope.abc', 'malformed')
    expectBindingError(encodeAppDoctorReviewBinding(binding).replace('adr1.', 'ADR1.'), 'malformed')
  })

  test('rejects oversized tokens as malformed before decoding them', () => {
    const oversized = `adr1.${'A'.repeat(MAX_TOKEN_LENGTH)}`

    expectBindingError(oversized, 'malformed')
    expect(() => decodeAppDoctorReviewBinding(oversized)).toThrow('too long')
    expect(() => decodeAppDoctorReviewBinding(oversized)).not.toThrow('base64url')
  })

  test('rejects a future token version as unsupported', () => {
    expectBindingError(`adr2.${Buffer.from('{}').toString('base64url')}`, 'unsupported_version')
    expectBindingError(encodePayload({...binding, version: 2}), 'unsupported_version')
  })

  test('rejects bad base64url and non-JSON payloads as malformed', () => {
    expectBindingError('adr1.', 'malformed')
    expectBindingError('adr1.not+base64/url=', 'malformed')
    expectBindingError(`adr1.${Buffer.from('not json').toString('base64url')}`, 'malformed')
    expectBindingError(`adr1.${Buffer.from('[1]').toString('base64url')}`, 'invalid')
  })

  test('rejects unknown keys, bad hashes, and missing fields as invalid', () => {
    expectBindingError(encodePayload({...binding, extra: true}), 'invalid')
    expectBindingError(encodePayload({...binding, engine: {...binding.engine, build: 1}}), 'invalid')
    expectBindingError(
      encodePayload({...binding, checks: [{id: 'A', version: 1, prompt_hash: 'sha256:short'}]}),
      'invalid',
    )
    expectBindingError(encodePayload({...binding, checks: [{id: 'A', version: 1, prompt_hash: HEX}]}), 'invalid')
    expectBindingError(encodePayload({...binding, scope_identity: ''}), 'invalid')
    expectBindingError(encodePayload({...binding, scope_identity: HEX}), 'invalid')
    expectBindingError(encodePayload({...binding, configuration_identity: `prefixed-${HEX}`}), 'invalid')
    expectBindingError(encodePayload({...binding, configuration_identity: HEX}), 'invalid')
    expectBindingError(
      encodePayload({...binding, checks: [{id: 'a_check', version: 1, prompt_hash: `sha256:${HEX}`}]}),
      'invalid',
    )
    expectBindingError(encodePayload({...binding, scope: {...binding.scope, boundary: {app: 'outside'}}}), 'invalid')
    expectBindingError(
      encodePayload({...binding, checks: [{id: 'A', version: 0, prompt_hash: `sha256:${HEX}`}]}),
      'invalid',
    )
  })

  test('rejects an empty checks list as invalid', () => {
    expectBindingError(encodePayload({...binding, checks: []}), 'invalid')
  })

  test('rejects checks that are not sorted by id or repeat an id', () => {
    expectBindingError(encodePayload({...binding, checks: [binding.checks[1], binding.checks[0]]}), 'invalid')
    expectBindingError(encodePayload({...binding, checks: [binding.checks[0], binding.checks[0]]}), 'invalid')
  })
})
