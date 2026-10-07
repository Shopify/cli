import {importCustomDataDefinitionsJsonOutputSchema, type ImportCustomDataDefinitionsResult} from './types.js'
import {expect, test} from 'vitest'

const emptyResult: ImportCustomDataDefinitionsResult = {
  status: 'success',
  storeDomain: 'test-shop.myshopify.com',
  metafieldCount: 0,
  metaobjectCount: 0,
  toml: '',
  skippedSections: [],
}

test('encodes native TOML without changing its bytes', () => {
  const toml =
    '# namespace: $app key: café owner_type: PRODUCT\r\n[product.metafields.app.café]\r\ntype = "single_line_text_field"\r\n'
  expect(
    JSON.parse(importCustomDataDefinitionsJsonOutputSchema.encode({...emptyResult, metafieldCount: 1, toml})),
  ).toEqual({
    ...emptyResult,
    metafieldCount: 1,
    toml,
  })
})

test('distinguishes known empty conversions from inaccessible sections', () => {
  expect(JSON.parse(importCustomDataDefinitionsJsonOutputSchema.encode(emptyResult))).toEqual(emptyResult)
  const skippedSections: ImportCustomDataDefinitionsResult['skippedSections'] = [
    {type: 'metafields', ownerType: 'PRODUCT'},
    {type: 'metaobjects'},
  ]
  expect(JSON.parse(importCustomDataDefinitionsJsonOutputSchema.encode({...emptyResult, skippedSections}))).toEqual({
    ...emptyResult,
    skippedSections,
  })
})

test.each([
  {field: 'status', value: 'failed'},
  {field: 'storeDomain', value: 'example.com'},
  {field: 'storeDomain', value: 'test-shop.myshopify.com.example.com'},
  {field: 'metafieldCount', value: -1},
  {field: 'metafieldCount', value: 0.5},
  {field: 'metaobjectCount', value: null},
  {field: 'toml', value: null},
  {field: 'skippedSections', value: [{type: 'metafields'}]},
  {field: 'skippedSections', value: [{type: 'metafields', ownerType: ''}]},
  {field: 'skippedSections', value: [{type: 'metaobjects', ownerType: 'PRODUCT'}]},
  {field: 'skippedSections', value: [{type: 'unknown'}]},
])('rejects an invalid $field: $value', ({field, value}) => {
  expect(() => importCustomDataDefinitionsJsonOutputSchema.validate({...emptyResult, [field]: value})).toThrow()
})

test('rejects accidental internal result fields', () => {
  expect(() => importCustomDataDefinitionsJsonOutputSchema.validate({...emptyResult, accessToken: 'secret'})).toThrow()
})
