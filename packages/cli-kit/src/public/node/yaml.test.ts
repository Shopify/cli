import {decodeYaml, encodeYaml} from './yaml.js'
import {describe, expect, test} from 'vitest'

describe('decodeYaml', () => {
  test('converts a YAML string to a simple object', () => {
    const input = `
    name: app
    `
    const result = decodeYaml(input)
    expect(result).toStrictEqual({name: 'app'})
  })

  test('converts a YAML string to a nested object', () => {
    const input = `
    webhooks:
      api_version: 2023-07
    `
    const result = decodeYaml(input)
    expect(result).toStrictEqual({webhooks: {api_version: '2023-07'}})
  })

  test('converts a YAML string to a deeply nested object', () => {
    const input = `
    access:
      admin:
        direct_api_mode: online
    `
    const result = decodeYaml(input)
    expect(result).toStrictEqual({access: {admin: {direct_api_mode: 'online'}}})
  })
})

describe('encodeYaml', () => {
  test('converts a simple object to YAML string', () => {
    const input = {name: 'app'}
    const result = encodeYaml(input)
    expect(result).toBe('name: app\n')
  })

  test('converts a nested object to YAML string', () => {
    const input = {webhooks: {api_version: '2023-07'}}
    const result = encodeYaml(input)
    expect(result).toBe('webhooks:\n  api_version: 2023-07\n')
  })

  test('converts a deeply nested object to YAML string', () => {
    const input = {access: {admin: {direct_api_mode: 'online'}}}
    const result = encodeYaml(input)
    expect(result).toBe('access:\n  admin:\n    direct_api_mode: online\n')
  })
})
