import {decodeToml} from './toml.js'
import {describe, expect, test} from 'vitest'

describe('decodeToml', () => {
  test("returns {name} when input is name = 'app'", () => {
    const input = `
    name = 'app'
    `
    const result = decodeToml(input)
    expect(result).toStrictEqual({name: 'app'})
  })

  test('returns {webhooks: {api_version}} when input is [webhooks.api_version] = "2023-07"', () => {
    const input = `
    [webhooks]
    api_version = "2023-07"
    `
    const result = decodeToml(input)
    expect(result).toStrictEqual({webhooks: {api_version: '2023-07'}})
  })

  test('returns {access: {admin: {direct_api_mode}}} when input is [access.admin.direct_api_mode] = "online"', () => {
    const input = `
    [access]
    admin = {direct_api_mode = "online"}
    `
    const result = decodeToml(input)
    expect(result).toStrictEqual({access: {admin: {direct_api_mode: 'online'}}})
  })
})
