/**
 * Regression tests for the schema field extractor in major-change-check.js.
 *
 * These cover the three failure modes Isaac flagged in the review of #7351:
 *
 *   1. Nested `.object(...)` siblings dropped by the non-greedy regex.
 *   2. `.extend({...})` blocks ignored entirely by the substring guard.
 *   3. Quoted keys (`'foo': ...`, `"foo": ...`) ignored.
 *
 * Run with `node --test workspace/src/major-change-check.test.js`.
 */

import {test} from 'node:test'
import assert from 'node:assert/strict'

import {extractSchemaFields, stripStringsAndComments} from './major-change-check.js'

test('extracts top-level keys from a flat .object({...})', () => {
  const src = `
    const Schema = zod.object({
      name: zod.string(),
      version: zod.string().optional(),
    })
  `
  assert.deepEqual([...extractSchemaFields(src)].sort(), ['name', 'version'])
})

test('captures sibling fields after a nested .object({...})', () => {
  // This was the primary regression: the old regex was non-greedy and
  // closed the outer object at the FIRST `}\s*)`, so `qux` was silently
  // dropped and removing it would not be detected.
  const src = `
    const Schema = zod.object({
      foo: zod.string(),
      bar: zod.object({
        baz: zod.number(),
      }),
      qux: zod.boolean(),
    })
  `
  const fields = extractSchemaFields(src)
  assert.ok(fields.has('foo'), 'foo')
  assert.ok(fields.has('bar'), 'bar')
  assert.ok(fields.has('qux'), 'qux (post-nested sibling)')
  // We deliberately do NOT include `baz` — it's nested, not top-level.
  assert.equal(fields.has('baz'), false, 'baz is nested, must not appear')
})

test('captures fields added via BaseSchema.extend({...})', () => {
  // Mirrors `app_config_app_home.ts`: top-level fields are added through
  // `.extend(...)`, never `.object(...)`. The previous heuristic missed
  // these entirely because `.extend(` did not match its substring guard.
  const src = `
    import {BaseSchemaWithoutHandle} from '../base'
    export const AppHomeSpec = BaseSchemaWithoutHandle.extend({
      application_url: zod.string().url(),
      embedded: zod.boolean().default(true),
    })
  `
  assert.deepEqual([...extractSchemaFields(src)].sort(), ['application_url', 'embedded'])
})

test('handles chained .extend({...}).extend({...})', () => {
  const src = `
    const S = Base.extend({
      first: zod.string(),
    }).extend({
      second: zod.string(),
    })
  `
  assert.deepEqual([...extractSchemaFields(src)].sort(), ['first', 'second'])
})

test('handles quoted keys', () => {
  const src = `
    const S = zod.object({
      'kebab-case-ish': zod.string(),
      "double_quoted": zod.string(),
      bare: zod.string(),
    })
  `
  // Note: keys with hyphens are not valid bare identifiers, so kebab-case-ish
  // would only match if quoted. Our regex requires \w-only identifiers, so
  // this serves as a known-limitation test.
  const fields = extractSchemaFields(src)
  assert.ok(fields.has('double_quoted'), 'double_quoted')
  assert.ok(fields.has('bare'), 'bare')
})

test('ignores keys inside nested arrays and function calls', () => {
  const src = `
    const S = zod.object({
      tags: zod.array(zod.object({ value: zod.string() })),
      url: zod.string().refine((v) => v.startsWith('https://'), { message: 'bad' }),
    })
  `
  const fields = extractSchemaFields(src)
  assert.deepEqual([...fields].sort(), ['tags', 'url'])
  assert.equal(fields.has('value'), false, 'nested object inside array')
  assert.equal(fields.has('message'), false, 'object inside refine() call')
})

test('ignores keys inside string literals and comments', () => {
  const src = `
    // foo: zod.string(),
    /* bar: zod.string(), */
    const S = zod.object({
      real: zod.string(),
      example: zod.literal('fake: zod.string()'),
    })
  `
  const fields = extractSchemaFields(src)
  assert.ok(fields.has('real'))
  assert.ok(fields.has('example'))
  assert.equal(fields.has('foo'), false, 'line comment')
  assert.equal(fields.has('bar'), false, 'block comment')
  assert.equal(fields.has('fake'), false, 'inside string literal')
})

test('returns empty set on an unbalanced/incomplete file', () => {
  // Don't crash if the file is mid-edit / truncated.
  const src = `const S = zod.object({ foo: zod.string(),`
  const fields = extractSchemaFields(src)
  assert.equal(fields.size, 0)
})

test('stripStringsAndComments preserves length and newlines', () => {
  const src = `const a = "hello\\nworld" // trailing\nconst b = /* x */ 1\n`
  const stripped = stripStringsAndComments(src)
  assert.equal(stripped.length, src.length, 'length preserved')
  // Newlines must survive so line numbers in error messages still align.
  const newlinesIn = (s) => (s.match(/\n/g) || []).length
  assert.equal(newlinesIn(stripped), newlinesIn(src), 'newlines preserved')
  // The contents of strings and comments must be gone.
  assert.equal(stripped.includes('hello'), false)
  assert.equal(stripped.includes('trailing'), false)
})
