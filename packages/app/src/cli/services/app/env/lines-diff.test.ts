import {diffLines} from './lines-diff.js'
import {LinesDiffSegment} from '@shopify/cli-kit/node/output'
import {describe, expect, test} from 'vitest'

// These expectations were produced by `diff`'s `diffLines` (with the `count` field dropped) and
// asserted byte-for-byte equal to the inlined `diffLines` helper while `diff` was still installed
// (see the commit that removed the dependency). They are now frozen as static fixtures so the
// parity guarantee is preserved without depending on `diff`. Each case targets an `.env` edge case
// that the `app env pull` diff can encounter.

interface DiffCase {
  name: string
  old: string
  new: string
  expected: LinesDiffSegment[]
}

const cases: DiffCase[] = [
  {
    name: 'the exact pull.test.ts ABC/XYZ case',
    old: 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\nSCOPES=my-scope',
    new: 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope',
    expected: [
      {value: 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\n', removed: true},
      {value: 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\n', added: true},
      {value: 'SCOPES=my-scope'},
    ],
  },
  {
    name: 'multiline quoted values (value spanning multiple physical lines)',
    old: 'FOO="line1\nline2"\nBAR=baz',
    new: 'FOO="line1\nline2-edited"\nBAR=baz',
    expected: [
      {value: 'FOO="line1\n'},
      {value: 'line2"\n', removed: true},
      {value: 'line2-edited"\n', added: true},
      {value: 'BAR=baz'},
    ],
  },
  {
    name: 'quote escaping changes',
    old: 'FOO="a\\"b"\nBAR=1',
    new: 'FOO="a\\\\b"\nBAR=1',
    expected: [{value: 'FOO="a\\"b"\n', removed: true}, {value: 'FOO="a\\\\b"\n', added: true}, {value: 'BAR=1'}],
  },
  {
    name: 'CRLF line endings with a changed line',
    old: 'a\r\nb\r\nc\r\n',
    new: 'a\r\nx\r\nc\r\n',
    expected: [{value: 'a\r\n'}, {value: 'b\r\n', removed: true}, {value: 'x\r\n', added: true}, {value: 'c\r\n'}],
  },
  {
    name: 'CRLF added and removed lines',
    old: 'KEY=1\r\nOLD=2\r\n',
    new: 'KEY=1\r\nNEW=3\r\nEXTRA=4\r\n',
    expected: [{value: 'KEY=1\r\n'}, {value: 'OLD=2\r\n', removed: true}, {value: 'NEW=3\r\nEXTRA=4\r\n', added: true}],
  },
  {
    name: 'trailing newline removed (last line loses its newline)',
    old: 'a\nb\nc\n',
    new: 'a\nb\nc',
    expected: [{value: 'a\nb\n'}, {value: 'c\n', removed: true}, {value: 'c', added: true}],
  },
  {
    name: 'trailing newline added (last line gains a newline)',
    old: 'a\nb\nc',
    new: 'a\nb\nc\n',
    expected: [{value: 'a\nb\n'}, {value: 'c', removed: true}, {value: 'c\n', added: true}],
  },
  {
    name: 'empty old string (file creation-ish)',
    old: '',
    new: 'SHOPIFY_API_KEY=api-key\nSCOPES=s',
    expected: [{value: 'SHOPIFY_API_KEY=api-key\nSCOPES=s', added: true}],
  },
  {
    name: 'identical strings (no changes)',
    old: 'x\ny\nz',
    new: 'x\ny\nz',
    expected: [{value: 'x\ny\nz'}],
  },
  {
    name: 'both empty strings',
    old: '',
    new: '',
    expected: [{value: ''}],
  },
  {
    name: 'pure addition at the end',
    old: 'a\nb\nc',
    new: 'a\nb\nc\nd\ne',
    expected: [{value: 'a\nb\n'}, {value: 'c', removed: true}, {value: 'c\nd\ne', added: true}],
  },
  {
    name: 'pure removal at the end',
    old: 'a\nb\nc\nd\ne',
    new: 'a\nb\nc',
    expected: [{value: 'a\nb\n'}, {value: 'c\nd\ne', removed: true}, {value: 'c', added: true}],
  },
  {
    name: 'interleaved changes',
    old: 'a\nb\nc\nd',
    new: 'x\nb\ny\nd',
    expected: [
      {value: 'a\n', removed: true},
      {value: 'x\n', added: true},
      {value: 'b\n'},
      {value: 'c\n', removed: true},
      {value: 'y\n', added: true},
      {value: 'd'},
    ],
  },
]

describe('diffLines', () => {
  test.each(cases)('produces the expected jsdiff-parity segments for: $name', ({old, new: updated, expected}) => {
    expect(diffLines(old, updated)).toEqual(expected)
  })
})
