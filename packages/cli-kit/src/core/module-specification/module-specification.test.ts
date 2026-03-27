import {ModuleSpecification} from './module-specification.js'
import {Contract} from '../contract/contract.js'
import {describe, expect, test} from 'vitest'

describe('ModuleSpecification', () => {
  test('stores all provided fields as readonly', () => {
    const spec = new ModuleSpecification({
      identifier: 'app_home',
      name: 'App home',
      externalIdentifier: 'app_home_external',
      appModuleLimit: 1,
      uidIsClientProvided: false,
      features: ['argo'],
    })

    expect(spec.identifier).toBe('app_home')
    expect(spec.name).toBe('App home')
    expect(spec.externalIdentifier).toBe('app_home_external')
    expect(spec.appModuleLimit).toBe(1)
    expect(spec.uidIsClientProvided).toBe(false)
    expect(spec.features).toStrictEqual(['argo'])
    expect(spec.contract).toBeUndefined()
  })

  test('stores a contract when provided', async () => {
    const contract = await Contract.fromJsonSchema(
      JSON.stringify({
        type: 'object',
        properties: {name: {type: 'string'}},
      }),
    )

    const spec = new ModuleSpecification({
      identifier: 'branding',
      name: 'Branding',
      externalIdentifier: 'branding_external',
      contract,
      appModuleLimit: 1,
      uidIsClientProvided: false,
      features: [],
    })

    expect(spec.contract).toBe(contract)
    expect(spec.contract!.validate({name: 'My App'})).toHaveLength(0)
  })
})
