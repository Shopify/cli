import {BulkOperationSchema, BulkOperationContextSchema, BulkOperationGidSchema} from './common.js'
import {bulkOperationJsonContext, toBulkOperationJson} from './json.js'
import {testBulkOperation} from './bulk-operation.test-data.js'
import {expect, test} from 'vitest'

function projectedOperation() {
  return {
    gid: 'gid://shopify/BulkOperation/123',
    type: 'QUERY',
    status: 'RUNNING',
    errorCode: null,
    createdAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    objectCount: '2',
    url: null,
    partialDataUrl: null,
  }
}

test('projects only selected fields and normalizes missing values and timestamps', () => {
  expect(
    toBulkOperationJson({
      id: 'gid://shopify/BulkOperation/123',
      type: 'QUERY',
      status: 'RUNNING',
      objectCount: '2',
      createdAt: '2026-09-01T02:00:00.999+02:00',
    }),
  ).toEqual(projectedOperation())
})

test('preserves large counts and normalizes completion instants without rounding', () => {
  const operation = testBulkOperation({
    objectCount: '900719925474099312345',
    completedAt: '2026-09-01T02:01:00.999+02:00',
  })
  expect(toBulkOperationJson(operation)).toEqual({
    ...projectedOperation(),
    objectCount: '900719925474099312345',
    completedAt: '2026-09-01T00:01:00Z',
  })
})

test('rejects unsafe counts rather than losing integer precision', () => {
  expect(() => toBulkOperationJson(testBulkOperation({objectCount: Number.MAX_SAFE_INTEGER + 1}))).toThrow(
    "can't be represented exactly",
  )
})

test.each([
  {field: 'gid', value: '123'},
  {field: 'createdAt', value: '2026-09-01T00:00:00.100Z'},
  {field: 'createdAt', value: '2026-09-01T02:00:00+02:00'},
  {field: 'completedAt', value: ''},
  {field: 'objectCount', value: 2},
  {field: 'objectCount', value: '-1'},
  {field: 'objectCount', value: '1.5'},
  {field: 'url', value: ''},
])('rejects invalid $field with all other fields valid', ({field, value}) => {
  expect(() => BulkOperationSchema.parse({...projectedOperation(), [field]: value})).toThrow()
})

test('rejects unselected fields while accepting upstream enum values', () => {
  expect(() => BulkOperationSchema.parse({...projectedOperation(), token: 'secret'})).toThrow()
  expect(() =>
    BulkOperationSchema.parse({
      ...projectedOperation(),
      type: 'FUTURE_TYPE',
      status: 'FUTURE_STATUS',
      errorCode: 'FUTURE_ERROR',
    }),
  ).not.toThrow()
})

test.each([
  {
    context: {store: 'shop.myshopify.com', apiVersion: '2026-01'},
    expected: {storeDomain: 'shop.myshopify.com', apiVersion: '2026-01'},
  },
  {context: {store: 'custom.example.com'}, expected: {storeDomain: null, apiVersion: null}},
  {context: {}, expected: {storeDomain: null, apiVersion: null}},
])('maps context without inventing a canonical store domain: $context', ({context, expected}) => {
  expect(bulkOperationJsonContext(context)).toEqual(expected)
  expect(BulkOperationContextSchema.parse(expected)).toEqual(expected)
})

test('context rejects unknown fields and noncanonical store domains', () => {
  expect(() => BulkOperationContextSchema.parse({storeDomain: 'custom.example.com', apiVersion: null})).toThrow()
  expect(() => BulkOperationContextSchema.parse({storeDomain: null, apiVersion: null, token: 'secret'})).toThrow()
})

test.each(['gid://shopify/Product/123', 'gid://shopify/BulkOperation/123/extra'])(
  'rejects a GID outside the bulk-operation namespace: %s',
  (gid) => {
    expect(() => BulkOperationGidSchema.parse(gid)).toThrow()
  },
)
