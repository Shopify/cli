import {graphiqlJsonOutputSchema} from './schema.js'
import {expect, test} from 'vitest'
import {Ajv} from 'ajv'

test.each(['shop.myshopify.com', 'shop.myshopify.io', 'shop.my.shop.dev', 'nested.shop.myshopify.com'])(
  'publishes a self-contained JSON Schema for every lifecycle record with store %s',
  (storeDomain) => {
    const validate = new Ajv({formats: {'date-time': true, uri: true}}).compile(graphiqlJsonOutputSchema.jsonSchema)
    const timestamp = '2026-10-21T10:20:30Z'
    for (const record of [
      {type: 'starting', timestamp, storeDomain},
      {
        type: 'ready',
        timestamp,
        storeDomain,
        url: 'http://localhost:3456/graphiql?key=key',
        api: 'admin',
        apiVersion: null,
        mutationsAllowed: false,
        app: null,
      },
      {type: 'stopped', timestamp, reason: 'cancelled'},
    ]) {
      expect(validate(record), JSON.stringify(validate.errors)).toBe(true)
      expect(graphiqlJsonOutputSchema.validate(record)).toEqual(record)
      expect(validate({...record, accessToken: 'secret'})).toBe(false)
    }
  },
)

test.each(['', 'https://shop.myshopify.io', 'shop.my.shop.dev/admin', 'shop..myshopify.com'])(
  'rejects store domains that are not normalized hostnames (%s)',
  (storeDomain) => {
    const record = {type: 'starting', timestamp: '2026-10-21T10:20:30Z', storeDomain}
    expect(() => graphiqlJsonOutputSchema.validate(record)).toThrow()
    expect(
      new Ajv({formats: {'date-time': true, uri: true}}).compile(graphiqlJsonOutputSchema.jsonSchema)(record),
    ).toBe(false)
  },
)

test.each(['2026-10-21T10:20:30.123Z', '2026-10-21T10:20:30+00:00'])(
  'rejects noncanonical timestamp %s',
  (timestamp) => {
    const record = {type: 'starting', timestamp, storeDomain: 'shop.myshopify.com'}
    expect(() => graphiqlJsonOutputSchema.validate(record)).toThrow()
    expect(
      new Ajv({formats: {'date-time': true, uri: true}}).compile(graphiqlJsonOutputSchema.jsonSchema)(record),
    ).toBe(false)
  },
)
