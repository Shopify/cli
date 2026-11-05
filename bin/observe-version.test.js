import assert from 'node:assert/strict'
import {test} from 'node:test'

import {applyVersion, patchVersionInFilterJson, patchVersionString} from './observe-version.js'

for (const [input, expected] of [
  ['(v4.9.3)', '(v4.9.4)'],
  ['v4.9.3', 'v4.9.4'],
  ['CLI-v4.9.3', 'CLI-v4.9.4'],
  ['(4.9.3)', '(4.9.4)'],
  ['(Version 4.9.3)', '(Version 4.9.4)'],
  ['sum(rate(cli_errors{cli_version="4.9.3"}[5m]))', 'sum(rate(cli_errors{cli_version="4.9.4"}[5m]))'],
  ['(v4.9.3) and (4.9.2)', '(v4.9.4) and (4.9.4)'],
]) {
  test(`rewrites version literals in ${input}`, () => {
    assert.equal(patchVersionString(input, '4.9.4'), expected)
  })
}

for (const input of ['1.2.3.4', 'foo1.2.3', 'dev4.9.3', 'vv4.9.3', '4.9.3.tgz', 'cli-4.9.3.tgz']) {
  test(`does not rewrite any part of ${input}`, () => {
    assert.equal(patchVersionString(input, '4.9.4'), input)
  })
}

for (const [input, expected] of [
  ['3.*.*', '4.*.*'],
  ['4.90.*', '4.95.*'],
  ['*.*.*', '*.*.*'],
]) {
  test(`preserves wildcards in ${input}`, () => {
    assert.equal(applyVersion(input, '4.95.3'), expected)
    assert.equal(patchVersionString(input, '4.95.3'), expected)
    assert.equal(patchVersionString(`(v${input})`, '4.95.3'), `(v${expected})`)
  })
}

test('preserves non-string values', () => {
  for (const value of [undefined, null, 42]) {
    assert.equal(patchVersionString(value, '4.9.4'), value)
  }
})

test('uses the target version when the filter value does not have three components', () => {
  assert.equal(applyVersion('4.9', '4.9.4'), '4.9.4')
})

test('patches only string values for the selected column in nested filter groups', () => {
  const filters = {
    operator: 'and',
    filters: [
      {column: 'app.version', operator: 'eq', value: '4.9.3'},
      {column: 'message', operator: 'eq', value: '4.9.3'},
      {column: 'app.version', operator: 'eq', value: 42},
      {column: 'app.version', operator: 'eq', value: null},
    ],
    'filter_groups': [
      {
        operator: 'or',
        filters: [{column: 'app.version', operator: 'eq', value: '3.*.*'}],
        'filter_groups': [{filters: [{column: 'app.version', operator: 'eq', value: '4.90.*'}]}],
      },
      {},
    ],
  }
  const expected = {
    ...filters,
    filters: [{column: 'app.version', operator: 'eq', value: '4.95.3'}, ...filters.filters.slice(1)],
    'filter_groups': [
      {
        operator: 'or',
        filters: [{column: 'app.version', operator: 'eq', value: '4.*.*'}],
        'filter_groups': [{filters: [{column: 'app.version', operator: 'eq', value: '4.95.*'}]}],
      },
      {},
    ],
  }

  assert.deepEqual(JSON.parse(patchVersionInFilterJson(JSON.stringify(filters), 'app.version', '4.95.3')), expected)
})

test('rejects invalid filter JSON', () => {
  assert.throws(() => patchVersionInFilterJson('{', 'app.version', '4.9.4'), SyntaxError)
})
