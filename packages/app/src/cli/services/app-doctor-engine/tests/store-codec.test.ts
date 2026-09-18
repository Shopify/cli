import {
  MAX_STORE_FILE_BYTES,
  checkResultOwnership,
  decodeStoreJson,
  encodeStoreText,
  parseResultLeaf,
  resultLeaf,
  stageLeaf,
} from '../store/codec.js'
import {describe, expect, test} from 'vitest'
import {createHash} from 'node:crypto'

const SCOPE_HEX_A = createHash('sha256').update('scope-a', 'utf8').digest('hex')
const SCOPE_HEX_B = createHash('sha256').update('scope-b', 'utf8').digest('hex')
const SCOPE_A = `sha256:${SCOPE_HEX_A}`
const SCOPE_B = `sha256:${SCOPE_HEX_B}`
const CONFIGURATION_A = 'a'.repeat(32)
const CONFIGURATION_B = 'b'.repeat(32)

describe('resultLeaf', () => {
  test('truncates the scope digest to 32 hex characters and keeps the check id verbatim', () => {
    const leaf = resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_A', mode: 'static'})
    expect(leaf).toBe(`${SCOPE_HEX_A.slice(0, 32)}.CHECK_A.static.json`)
  })

  test('uses the mode as the suffix', () => {
    const key = {scopeIdentity: SCOPE_A, checkId: 'CHECK_A'}
    expect(resultLeaf({...key, mode: 'agent'})).toMatch(/\.agent\.json$/)
    expect(resultLeaf({...key, mode: 'static'})).toMatch(/\.static\.json$/)
    expect(resultLeaf({...key, mode: 'agent'})).not.toBe(resultLeaf({...key, mode: 'static'}))
  })

  test('distinguishes scopes and checks', () => {
    const base = resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_A', mode: 'static'})
    expect(resultLeaf({scopeIdentity: SCOPE_B, checkId: 'CHECK_A', mode: 'static'})).not.toBe(base)
    expect(resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_B', mode: 'static'})).not.toBe(base)
  })

  test('rejects a scope identity that is not a sha256 digest', () => {
    expect(() => resultLeaf({scopeIdentity: 'scope-a', checkId: 'CHECK_A', mode: 'static'})).toThrow(/scope identity/)
    expect(() => resultLeaf({scopeIdentity: SCOPE_HEX_A, checkId: 'CHECK_A', mode: 'static'})).toThrow(/scope identity/)
  })

  test('rejects a check id outside the catalogue grammar', () => {
    expect(() => resultLeaf({scopeIdentity: SCOPE_A, checkId: 'check_a', mode: 'static'})).toThrow(/check id/)
    expect(() => resultLeaf({scopeIdentity: SCOPE_A, checkId: '', mode: 'static'})).toThrow(/check id/)
  })

  test('stage names are dot-prefixed with a .next suffix', () => {
    const leaf = `${'a'.repeat(32)}.CHECK_A.static.json`
    expect(stageLeaf(leaf)).toBe(`.${leaf}.next`)
  })
})

describe('parseResultLeaf', () => {
  test('round-trips a generated leaf', () => {
    const leaf = resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_A', mode: 'agent'})
    expect(parseResultLeaf(leaf)).toEqual({scopeDigest: SCOPE_HEX_A.slice(0, 32), checkId: 'CHECK_A', mode: 'agent'})
  })

  test('accepts the longest check id the grammar allows', () => {
    const checkId = `A${'0'.repeat(63)}`
    expect(parseResultLeaf(`${'a'.repeat(32)}.${checkId}.static.json`)).toMatchObject({checkId})
  })

  test('rejects stage files, uppercase hex, and foreign names', () => {
    const leaf = resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_A', mode: 'agent'})
    expect(parseResultLeaf(stageLeaf(leaf))).toBeUndefined()
    expect(parseResultLeaf(leaf.toUpperCase())).toBeUndefined()
    expect(parseResultLeaf('notes.json')).toBeUndefined()
    expect(parseResultLeaf(leaf.replace('.agent.', '.manual.'))).toBeUndefined()
  })

  test('rejects check ids outside the grammar', () => {
    const scope = 'a'.repeat(32)
    expect(parseResultLeaf(`${scope}.check_a.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}.Check_A.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}.1CHECK.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}._CHECK.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}.CHECK-A.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}..static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${scope}.A${'0'.repeat(64)}.static.json`)).toBeUndefined()
  })

  test('rejects scopes that are not exactly 32 lowercase hex characters', () => {
    expect(parseResultLeaf(`${'a'.repeat(64)}.CHECK_A.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${'a'.repeat(31)}.CHECK_A.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`sha256:${'a'.repeat(32)}.CHECK_A.static.json`)).toBeUndefined()
    expect(parseResultLeaf(`${'g'.repeat(32)}.CHECK_A.static.json`)).toBeUndefined()
  })
})

describe('encodeStoreText', () => {
  test('encodes UTF-8 within the limit', () => {
    const encoded = encodeStoreText('héllo\n')
    expect(encoded).toEqual({ok: true, bytes: Buffer.from('héllo\n', 'utf8')})
  })

  test('rejects content one byte over the limit and accepts content at the limit', () => {
    expect(encodeStoreText('a'.repeat(MAX_STORE_FILE_BYTES))).toMatchObject({ok: true})
    expect(encodeStoreText('a'.repeat(MAX_STORE_FILE_BYTES + 1))).toMatchObject({ok: false, code: 'oversized'})
  })
})

describe('decodeStoreJson', () => {
  test('decodes valid UTF-8 JSON', () => {
    expect(decodeStoreJson(Buffer.from('{"count":1}\n', 'utf8'))).toEqual({ok: true, value: {count: 1}})
  })

  test('reports invalid UTF-8 as malformed without echoing bytes', () => {
    const outcome = decodeStoreJson(Buffer.from([0xff, 0xfe, 0x7b]))
    expect(outcome).toMatchObject({ok: false, code: 'malformed'})
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.message).not.toContain('\ufffd')
  })

  test('reports invalid JSON as malformed', () => {
    expect(decodeStoreJson(Buffer.from('{"a":', 'utf8'))).toMatchObject({ok: false, code: 'malformed'})
  })
})

describe('checkResultOwnership', () => {
  const owner = {
    configuration_identity: CONFIGURATION_A,
    scope_identity: SCOPE_A,
    check_id: 'CHECK_A',
    mode: 'static',
  } as const
  const leaf = resultLeaf({scopeIdentity: SCOPE_A, checkId: 'CHECK_A', mode: 'static'})

  test('accepts a consistent envelope', () => {
    expect(checkResultOwnership(CONFIGURATION_A, leaf, owner)).toBeUndefined()
  })

  test('reports a foreign configuration as misowned', () => {
    expect(checkResultOwnership(CONFIGURATION_B, leaf, owner)).toBe('misowned')
  })

  test('reports an envelope that does not match the filename', () => {
    expect(checkResultOwnership(CONFIGURATION_A, leaf, {...owner, check_id: 'CHECK_B'})).toBe('filename-mismatch')
    expect(checkResultOwnership(CONFIGURATION_A, leaf, {...owner, mode: 'agent'})).toBe('filename-mismatch')
    expect(checkResultOwnership(CONFIGURATION_A, leaf, {...owner, scope_identity: SCOPE_B})).toBe('filename-mismatch')
  })

  test('compares only the truncated scope prefix, which is all the filename carries', () => {
    const sibling = `sha256:${SCOPE_HEX_A.slice(0, 32)}${'f'.repeat(32)}`
    expect(checkResultOwnership(CONFIGURATION_A, leaf, {...owner, scope_identity: sibling})).toBeUndefined()
  })
})
