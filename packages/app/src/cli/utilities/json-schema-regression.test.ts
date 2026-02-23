/**
 * Regression test for the access_scopes silent data loss incident.
 *
 * Background:
 *   Modules with `transformLocalToRemote` have TOML-shaped configuration that differs
 *   from the API-shaped contract. For example, access_scopes in TOML uses the key
 *   `access_scopes.scopes`, but the API contract expects `access.scopes`.
 *
 *   Previously, `unifiedConfigurationParserFactory` validated TOML-shaped data against
 *   the API-shaped contract in "strip" mode for all modules, including those with
 *   `transformLocalToRemote`. In strip mode, top-level properties not present in the
 *   contract's `properties` are silently removed. Since the TOML key `access_scopes`
 *   did not match the API key `access`, strip mode removed it -- producing `{}`.
 *   This empty config was deployed, wiping the app's access scopes configuration.
 *
 * The fix:
 *   1. `unifiedConfigurationParserFactory` now skips contract validation for modules
 *      with `transformLocalToRemote`, returning the zod parser directly.
 *   2. `deployConfig()` validates post-encode (API-shaped) data using "fail" mode,
 *      catching mismatches as errors rather than silently stripping fields.
 */

import {unifiedConfigurationParserFactory} from './json-schema.js'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {describe, test, expect} from 'vitest'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

/**
 * Returns a fresh copy of the API-shaped contract for access scopes.
 * The API expects `access.scopes` (string) and `access.use_legacy_install_flow` (boolean).
 *
 * IMPORTANT: This must be a factory function rather than a shared constant because
 * `createAjvValidator` in strip mode mutates `schema.additionalProperties = true`.
 * If a shared object were reused, a test running in strip mode would corrupt the
 * contract for any subsequent test running in fail mode.
 */
function makeAccessScopesApiContract() {
  return {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      access: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          scopes: {type: 'string' as const},
          use_legacy_install_flow: {type: 'boolean' as const},
        },
      },
    },
  }
}

/**
 * TOML-shaped data -- what the developer writes in their shopify.app.toml.
 * Uses the `access_scopes` key, not the API's `access` key.
 */
const tomlShapedData = {
  access_scopes: {
    scopes: 'read_products,write_products',
    use_legacy_install_flow: true,
  },
}

/**
 * API-shaped data -- what `transformLocalToRemote` / `encode()` produces.
 * Uses the `access` key, matching the contract.
 */
const apiShapedData = {
  access: {
    scopes: 'read_products,write_products',
    use_legacy_install_flow: true,
  },
}

describe('access_scopes silent data loss regression', () => {
  describe('jsonSchemaValidate behavior with mismatched shapes', () => {
    test('strip mode silently removes all fields when TOML shape differs from API contract (the bug)', () => {
      // This test proves the dangerous behavior that caused the incident.
      //
      // When TOML-shaped data (keys: access_scopes) is validated against the
      // API contract (keys: access) in strip mode:
      //   1. AJV validates with additionalProperties=true (so no errors)
      //   2. The stripping step removes top-level keys not in contract.properties
      //   3. Since "access_scopes" is not in contract.properties, it gets removed
      //   4. Result: {} -- complete silent data loss
      const result = jsonSchemaValidate(tomlShapedData, makeAccessScopesApiContract(), 'strip', randomUUID())

      expect(result.state).toBe('ok')
      // THIS IS THE BUG: the result is an empty object. All configuration was silently wiped.
      expect(result.data).toEqual({})
      // The developer's scopes configuration is gone -- no error, no warning, nothing.
      expect(Object.keys(result.data as object)).toHaveLength(0)
    })

    test('fail mode catches field mismatch instead of silently stripping (the fix)', () => {
      // Using "fail" mode, the same mismatch produces a validation error instead
      // of silently discarding the data.
      const result = jsonSchemaValidate(tomlShapedData, makeAccessScopesApiContract(), 'fail', randomUUID())

      expect(result.state).toBe('error')
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    test('correctly transformed (API-shaped) data passes validation in fail mode', () => {
      // After encode() / transformLocalToRemote converts TOML shape to API shape,
      // the data matches the contract and validation passes.
      const result = jsonSchemaValidate(apiShapedData, makeAccessScopesApiContract(), 'fail', randomUUID())

      expect(result.state).toBe('ok')
      expect(result.data).toEqual(apiShapedData)
    })
  })

  describe('unifiedConfigurationParserFactory bypass for transformLocalToRemote modules', () => {
    const mockParseConfigurationObject = (config: object) => ({
      state: 'ok' as const,
      data: config,
      errors: undefined,
    })

    test('modules with transformLocalToRemote skip contract validation entirely', async () => {
      // A module that has transformLocalToRemote should NOT have its TOML-shaped
      // data validated against the API contract. The factory should return the
      // zod parser directly, bypassing JSON schema validation.
      const merged = {
        identifier: randomUUID(),
        parseConfigurationObject: mockParseConfigurationObject,
        transformLocalToRemote: (config: object) => config,
        validationSchema: {
          jsonSchema: JSON.stringify(makeAccessScopesApiContract()),
        },
      }

      const parser = await unifiedConfigurationParserFactory(merged as any)

      // Validate TOML-shaped data. Because transformLocalToRemote is defined,
      // the factory should return the raw zod parser. The TOML data passes
      // zod and is never checked against the API contract.
      const result = parser(tomlShapedData)
      expect(result.state).toBe('ok')
      // The data is preserved intact -- no stripping occurred.
      expect(result.data).toEqual(tomlShapedData)
    })

    test('modules without transformLocalToRemote still get contract validation', async () => {
      // A module without transformLocalToRemote has matching TOML and API shapes,
      // so contract validation is safe and useful.
      const merged = {
        identifier: randomUUID(),
        parseConfigurationObject: mockParseConfigurationObject,
        // No transformLocalToRemote
        validationSchema: {
          jsonSchema: JSON.stringify(makeAccessScopesApiContract()),
        },
      }

      const parser = await unifiedConfigurationParserFactory(merged as any, 'strip')

      // Data that matches the contract passes fine.
      const goodResult = parser(apiShapedData)
      expect(goodResult.state).toBe('ok')
      expect(goodResult.data).toEqual(apiShapedData)

      // Data that does NOT match the contract gets stripped (this is safe because
      // for modules without transformLocalToRemote, the TOML and API shapes match,
      // so only genuinely extraneous fields are stripped).
      const resultWithExtra = parser({...apiShapedData, unknown_key: 'value'})
      expect(resultWithExtra.state).toBe('ok')
      expect(resultWithExtra.data).toEqual(apiShapedData)
    })
  })

  describe('end-to-end: the full incident scenario', () => {
    test('demonstrates the complete incident: TOML data -> strip validation -> empty deploy config', () => {
      // Step 1: Developer writes TOML with access_scopes configuration
      const developerToml = {
        access_scopes: {
          scopes: 'read_products,write_orders',
          use_legacy_install_flow: false,
        },
      }

      // Step 2: Old code path validated TOML data against API contract in strip mode
      const oldBehavior = jsonSchemaValidate(developerToml, makeAccessScopesApiContract(), 'strip', randomUUID())

      // Step 3: Strip mode produced {} -- all the developer's config was silently wiped
      expect(oldBehavior.state).toBe('ok')
      expect(oldBehavior.data).toEqual({})

      // Step 4: This {} was deployed, removing the app's access scopes
      const deployPayload = oldBehavior.data as {[key: string]: unknown}
      const wouldDeploy = Object.keys(deployPayload).length > 0 ? deployPayload : undefined
      // The deploy would send undefined (or {}), wiping the configuration
      expect(wouldDeploy).toBeUndefined()
    })

    test('demonstrates the fix: transform first, then validate in fail mode', () => {
      // Step 1: Developer writes TOML with access_scopes configuration
      const developerToml = {
        access_scopes: {
          scopes: 'read_products,write_orders',
          use_legacy_install_flow: false,
        },
      }

      // Step 2: encode() / transformLocalToRemote converts to API shape
      const transformed = {
        access: {
          scopes: developerToml.access_scopes.scopes,
          use_legacy_install_flow: developerToml.access_scopes.use_legacy_install_flow,
        },
      }

      // Step 3: Post-encode validation in fail mode confirms the data matches the contract
      const newBehavior = jsonSchemaValidate(transformed, makeAccessScopesApiContract(), 'fail', randomUUID())

      expect(newBehavior.state).toBe('ok')
      expect(newBehavior.data).toEqual(transformed)

      // Step 4: The correct configuration is deployed
      const deployPayload = newBehavior.data as {[key: string]: unknown}
      expect(deployPayload).toEqual({
        access: {
          scopes: 'read_products,write_orders',
          use_legacy_install_flow: false,
        },
      })
    })
  })
})
