/* eslint-disable no-restricted-imports */
import {mergeFixtureToml} from '../setup/app.js'
import {expect, test} from '@playwright/test'
import * as toml from '@iarna/toml'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VALID_APP_FIXTURE = fs.readFileSync(path.join(__dirname, '../data/valid-app/shopify.app.toml'), 'utf8')

test.describe('fixture TOML', () => {
  test('merges fixture values without dropping template-owned fields', () => {
    const generatedToml = `
client_id = "generated-client-id"
name = "Generated app name"
application_url = "https://template.example.com"

[access_scopes]
scopes = "read_products"

[sidekick]
extensions_summary = "Template-provided Sidekick summary"
template_owned = true
`.trimStart()

    const fixtureToml = `
client_id = "placeholder"
name = "placeholder"
application_url = "https://fixture.example.com"

[build]
include_config_on_deploy = true

[sidekick]
extensions_summary = "Fixture-provided Sidekick summary"
`.trimStart()

    const mergedToml = mergeFixtureToml(generatedToml, fixtureToml, 'E2E merged app')
    const parsed = toml.parse(mergedToml)

    expect(parsed.client_id).toBe('generated-client-id')
    expect(parsed.name).toBe('E2E merged app')
    expect(parsed.application_url).toBe('https://fixture.example.com')
    expect(parsed.access_scopes).toEqual({scopes: 'read_products'})
    expect(parsed.sidekick).toEqual({
      extensions_summary: 'Fixture-provided Sidekick summary',
      template_owned: true,
    })
    expect(parsed.build).toEqual({include_config_on_deploy: true})
  })

  test('valid app fixture can merge into generated template TOML', () => {
    const generatedToml = `
client_id = "generated-client-id"
name = "Generated app name"

[sidekick]
extensions_summary = "Template-provided Sidekick summary"
template_owned = true

[template_owned]
kept = true
`.trimStart()

    const mergedToml = mergeFixtureToml(generatedToml, VALID_APP_FIXTURE, 'E2E valid fixture app')
    const parsed = toml.parse(mergedToml)

    expect(parsed.client_id).toBe('generated-client-id')
    expect(parsed.name).toBe('E2E valid fixture app')
    expect(parsed.template_owned).toEqual({kept: true})
    expect(parsed.sidekick).toEqual({
      extensions_summary: 'Read, create, and edit FAQ entries stored in the app',
      template_owned: true,
    })
    expect(parsed.webhooks).toMatchObject({api_version: '2025-01'})
    expect((parsed.webhooks as {subscriptions: unknown[]}).subscriptions).toHaveLength(2)
  })
})
