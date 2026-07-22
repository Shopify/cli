import {airlockEnvironmentLabel, renderAirlockPreflight} from './preflight.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

import type {AirlockTarget} from './types.js'

vi.mock('@shopify/cli-kit/node/ui')

function target(overrides: Partial<AirlockTarget> = {}): AirlockTarget {
  return {
    environment: 'development',
    store: 'development.myshopify.com',
    source: 'explicit-environment',
    implicit: false,
    ...overrides,
  }
}

describe('airlockEnvironmentLabel', () => {
  test('labels the default target as implicit', () => {
    expect(airlockEnvironmentLabel(target({environment: 'default', source: 'default', implicit: true}))).toBe(
      'default (implicit)',
    )
  })

  test('labels the sole store target as the implicit sole project store', () => {
    expect(airlockEnvironmentLabel(target({environment: 'production', source: 'sole-store', implicit: true}))).toBe(
      'sole project store (implicit)',
    )
  })

  test('does not mark an explicit environment as implicit', () => {
    expect(airlockEnvironmentLabel(target({environment: 'production', implicit: true}))).toBe('production')
  })

  test('marks other implicit environments as implicit', () => {
    expect(airlockEnvironmentLabel(target({environment: 'development', source: 'bootstrap', implicit: true}))).toBe(
      'development (implicit)',
    )
  })
})

describe('renderAirlockPreflight', () => {
  test.each([
    {
      name: 'default',
      target: target({environment: 'default', source: 'default', implicit: true}),
      selectedBy: 'shopify.theme.toml',
    },
    {
      name: 'sole store',
      target: target({environment: 'production', source: 'sole-store', implicit: true}),
      selectedBy: 'shopify.theme.toml',
    },
    {
      name: 'explicit environment',
      target: target({environment: 'production'}),
      selectedBy: 'shopify.theme.toml',
    },
    {
      name: 'explicit store',
      target: target({source: 'explicit-store'}),
      selectedBy: '--store',
    },
    {
      name: 'environment variable store',
      target: target({source: 'environment-variable'}),
      selectedBy: 'SHOPIFY_FLAG_STORE',
    },
    {
      name: 'bootstrap',
      target: target({environment: 'new-environment', source: 'bootstrap'}),
      selectedBy: 'bootstrap setup',
    },
  ])('renders semantic rows for a single $name target', ({target: selectedTarget, selectedBy}) => {
    renderAirlockPreflight('push', [selectedTarget])

    const options = vi.mocked(renderInfo).mock.calls[0]?.[0]
    expect(options?.headline).toBe('Theme Airlock')
    const body = options?.customSections?.[0]?.body
    expect(body).toMatchObject({
      tabularData: [
        ['Environment', airlockEnvironmentLabel(selectedTarget)],
        ['Store', selectedTarget.store],
        ['Selected by', selectedBy],
        ['Operation', 'theme push'],
      ],
    })
  })

  test('renders every explicitly selected store with source, status, and operation in request order', () => {
    const targets = [
      target({environment: 'first', store: 'first.myshopify.com'}),
      target({
        environment: 'second',
        store: 'second.myshopify.com',
        source: 'explicit-store',
        implicit: true,
      }),
    ]

    renderAirlockPreflight('push', targets)

    const options = vi.mocked(renderInfo).mock.calls[0]?.[0]
    expect(options?.headline).toBe('Theme Airlock')
    expect(options?.body).toBe('The following explicitly selected stores will be used.')
    expect(options?.customSections?.[0]?.title).toBe('explicitly selected stores')
    expect(options?.customSections?.[0]?.body).toMatchObject({
      tabularData: [
        ['Environment', 'Store', 'Selected by', 'Status', 'Operation'],
        ['first', 'first.myshopify.com', 'shopify.theme.toml', 'explicit', 'theme push'],
        ['second', 'second.myshopify.com', '--store', 'implicit', 'theme push'],
      ],
    })
  })
})
