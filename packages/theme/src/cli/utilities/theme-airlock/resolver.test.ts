import {
  resolveBatchAirlockTargets,
  resolveSingleAirlockTarget,
  validateAirlockStoreSelectionSources,
} from './resolver.js'
import {ThemeAirlockError} from './types.js'
import {describe, expect, test, vi} from 'vitest'

import type {ThemeProjectTrust} from './types.js'

const configuredTrust: ThemeProjectTrust = {
  state: 'configured',
  path: '/theme/shopify.theme.toml',
  themePath: '/theme',
  environments: [
    {name: 'default', store: 'default-store.myshopify.com'},
    {name: 'preview', store: 'preview-store.myshopify.com'},
    {name: 'production', store: 'production-store.myshopify.com'},
  ],
}

const unconfiguredTrust: ThemeProjectTrust = {
  state: 'unconfigured',
  themePath: '/theme',
}

function captureAirlockError(operation: () => unknown): ThemeAirlockError {
  try {
    operation()
  } catch (error) {
    expect(error).toBeInstanceOf(ThemeAirlockError)
    if (error instanceof ThemeAirlockError) return error
    throw error
  }
  throw new Error('Expected operation to throw')
}

function resolveSingle({
  trust = configuredTrust,
  flags = {},
  argv = [],
  env = {},
}: {
  trust?: ThemeProjectTrust
  flags?: Record<string, boolean | string | string[] | number | undefined>
  argv?: string[]
  env?: NodeJS.ProcessEnv
} = {}) {
  return resolveSingleAirlockTarget({trust, flags, argv, env})
}

describe('resolveSingleAirlockTarget', () => {
  test.each([
    {
      name: 'a long CLI environment with a separate value',
      flags: {environment: 'preview'},
      argv: ['--environment', 'preview'],
    },
    {
      name: 'a short CLI environment with an equals value',
      flags: {environment: 'preview'},
      argv: ['-e=preview'],
    },
    {
      name: 'a short CLI environment with an attached value',
      flags: {environment: 'preview'},
      argv: ['-epreview'],
    },
  ])('resolves $name', ({flags, argv}) => {
    expect(resolveSingle({flags, argv})).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-environment',
      implicit: false,
    })
  })

  test('resolves an environment from SHOPIFY_FLAG_ENVIRONMENT', () => {
    expect(
      resolveSingle({
        flags: {environment: 'production'},
        env: {SHOPIFY_FLAG_ENVIRONMENT: 'production'},
      }),
    ).toEqual({
      environment: 'production',
      store: 'production-store.myshopify.com',
      source: 'explicit-environment',
      implicit: false,
    })
  })

  test.each([
    {
      name: 'a long CLI store with an equals value',
      flags: {store: 'preview-store.myshopify.com'},
      argv: ['--store=preview-store'],
    },
    {
      name: 'a short CLI store with a separate value',
      flags: {store: 'preview-store.myshopify.com'},
      argv: ['-s', 'preview-store'],
    },
    {
      name: 'a short CLI store with an attached value',
      flags: {store: 'preview-store.myshopify.com'},
      argv: ['-spreview-store'],
    },
  ])('resolves $name', ({flags, argv}) => {
    expect(resolveSingle({flags, argv})).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-store',
      implicit: false,
    })
  })

  test('ignores unrelated flags that contain selector names', () => {
    expect(resolveSingle({argv: ['--storefront', 'preview-store', '--environmental', 'preview', '-xpreview']})).toEqual(
      {
        environment: 'default',
        store: 'default-store.myshopify.com',
        source: 'default',
        implicit: true,
      },
    )
  })

  test('resolves a store selected only by SHOPIFY_FLAG_STORE', () => {
    expect(
      resolveSingle({
        flags: {store: 'preview-store.myshopify.com'},
        env: {SHOPIFY_FLAG_STORE: 'preview-store'},
      }),
    ).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'environment-variable',
      implicit: false,
    })
  })

  test.each([
    {
      name: '--store=',
      argv: ['--store='],
      env: {},
      reason: 'unknown-store' as const,
      message: '--store requires a value.',
    },
    {
      name: "SHOPIFY_FLAG_STORE: ''",
      argv: [],
      env: {SHOPIFY_FLAG_STORE: ''},
      reason: 'unknown-store' as const,
      message: 'SHOPIFY_FLAG_STORE requires a value.',
    },
    {
      name: '--environment=',
      argv: ['--environment='],
      env: {},
      reason: 'unknown-environment' as const,
      message: '--environment requires a value.',
    },
    {
      name: "SHOPIFY_FLAG_ENVIRONMENT: ''",
      argv: [],
      env: {SHOPIFY_FLAG_ENVIRONMENT: ''},
      reason: 'unknown-environment' as const,
      message: 'SHOPIFY_FLAG_ENVIRONMENT requires a value.',
    },
  ])('rejects an empty explicit selection from $name', ({argv, env, reason, message}) => {
    const error = captureAirlockError(() => resolveSingle({argv, env}))

    expect(error.reason).toBe(reason)
    expect(error.message).toBe(message)
  })

  test.each([
    {
      name: 'repeated long store selectors',
      argv: ['--store', 'preview-store', '--store', 'production-store'],
      message: 'Multiple --store selections were provided. Provide only one.',
    },
    {
      name: 'repeated short store selectors',
      argv: ['-spreview-store', '-sproduction-store'],
      message: 'Multiple --store selections were provided. Provide only one.',
    },
  ])('rejects $name', ({argv, message}) => {
    const error = captureAirlockError(() => resolveSingle({argv}))

    expect(error.reason).toBe('conflicting-selection')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(message)
  })

  test.each([
    {
      name: 'repeated long environment selectors',
      argv: ['--environment', 'preview', '--environment', 'production'],
      message: 'Multiple --environment selections were provided. Provide only one.',
    },
    {
      name: 'repeated short environment selectors',
      argv: ['-epreview', '-eproduction'],
      message: 'Multiple --environment selections were provided. Provide only one.',
    },
  ])('rejects $name', ({argv, message}) => {
    const error = captureAirlockError(() => resolveSingle({argv}))

    expect(error.reason).toBe('conflicting-selection')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(message)
  })

  test.each([
    {
      name: 'CLI store',
      argv: ['--store', 'not a store'],
      env: {},
      message: 'Invalid store value for --store: not a store.',
    },
    {
      name: 'environment-variable store',
      argv: [],
      env: {SHOPIFY_FLAG_STORE: 'not a store'},
      message: 'Invalid store value for SHOPIFY_FLAG_STORE: not a store.',
    },
  ])('rejects a malformed $name', ({argv, env, message}) => {
    const error = captureAirlockError(() => resolveSingle({argv, env}))

    expect(error.reason).toBe('invalid-store')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(message)
  })

  test('attributes a matching CLI and environment-variable store to the CLI', () => {
    expect(
      resolveSingle({
        flags: {store: 'preview-store.myshopify.com'},
        argv: ['--store', 'https://PREVIEW-STORE.myshopify.com/admin/'],
        env: {SHOPIFY_FLAG_STORE: 'preview-store'},
      }),
    ).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-store',
      implicit: false,
    })
  })

  test('rejects mismatching CLI and environment-variable stores', () => {
    const error = captureAirlockError(() =>
      resolveSingle({
        flags: {store: 'preview-store.myshopify.com'},
        argv: ['--store', 'preview-store'],
        env: {SHOPIFY_FLAG_STORE: 'production-store'},
      }),
    )

    expect(error.reason).toBe('conflicting-selection')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(
      'Store selections conflict: --store selects preview-store.myshopify.com, while SHOPIFY_FLAG_STORE selects production-store.myshopify.com.',
    )
  })

  test('rejects conflicting CLI and environment-variable stores before resolving an explicit environment', () => {
    const error = captureAirlockError(() =>
      resolveSingle({
        argv: ['--environment', 'unknown', '--store', 'preview-store'],
        env: {SHOPIFY_FLAG_STORE: 'production-store'},
      }),
    )

    expect(error.reason).toBe('conflicting-selection')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(
      'Store selections conflict: --store selects preview-store.myshopify.com, while SHOPIFY_FLAG_STORE selects production-store.myshopify.com.',
    )
  })

  test.each([
    {
      name: 'a matching CLI store',
      argv: ['--environment', 'preview', '--store', 'https://PREVIEW-STORE.myshopify.com/admin/'],
      env: {},
    },
    {
      name: 'a matching environment-variable store',
      argv: ['--environment=preview'],
      env: {SHOPIFY_FLAG_STORE: 'preview-store'},
    },
  ])('resolves an explicit environment combined with $name', ({argv, env}) => {
    expect(resolveSingle({argv, env})).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-environment',
      implicit: false,
    })
  })

  test.each([
    {
      name: 'a mismatching CLI store',
      argv: ['--environment', 'preview', '--store', 'production-store'],
      env: {},
    },
    {
      name: 'a mismatching environment-variable store',
      argv: ['--environment=preview'],
      env: {SHOPIFY_FLAG_STORE: 'production-store'},
    },
  ])('rejects an explicit environment combined with $name', ({argv, env}) => {
    const error = captureAirlockError(() => resolveSingle({argv, env}))

    expect(error.reason).toBe('conflicting-selection')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(
      'Environment "preview" selects preview-store.myshopify.com, but the store selection resolves to production-store.myshopify.com.',
    )
  })

  test('uses the CLI environment instead of SHOPIFY_FLAG_ENVIRONMENT', () => {
    expect(
      resolveSingle({
        flags: {environment: 'preview'},
        argv: ['--environment', 'preview'],
        env: {SHOPIFY_FLAG_ENVIRONMENT: 'production'},
      }),
    ).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-environment',
      implicit: false,
    })
  })

  test('resolves the configured default implicitly', () => {
    expect(resolveSingle()).toEqual({
      environment: 'default',
      store: 'default-store.myshopify.com',
      source: 'default',
      implicit: true,
    })
  })

  test('resolves the sole trusted store implicitly', () => {
    const trust: ThemeProjectTrust = {
      state: 'configured',
      path: '/theme/shopify.theme.toml',
      themePath: '/theme',
      environments: [{name: 'preview', store: 'preview-store'}],
    }

    expect(resolveSingle({trust})).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'sole-store',
      implicit: true,
    })
  })

  test.each([{flags: {}}, {flags: {force: true}}, {flags: {yes: true}}])(
    'rejects multiple trusted stores without a default regardless of non-selection flags: $flags',
    ({flags}) => {
      const trust: ThemeProjectTrust = {
        state: 'configured',
        path: '/theme/shopify.theme.toml',
        themePath: '/theme',
        environments: [
          {name: 'preview', store: 'preview-store'},
          {name: 'production', store: 'production-store'},
        ],
      }

      const error = captureAirlockError(() => resolveSingle({trust, flags}))

      expect(error.reason).toBe('ambiguous-selection')
      expect(error.targets).toEqual([])
      expect(error.message).toBe('Multiple trusted stores are configured. Use --environment or --store to select one.')
    },
  )

  test('rejects an unknown environment', () => {
    const error = captureAirlockError(() =>
      resolveSingle({flags: {environment: 'staging'}, argv: ['--environment=staging']}),
    )

    expect(error.reason).toBe('unknown-environment')
    expect(error.targets).toEqual([])
    expect(error.message).toBe('Environment "staging" is not configured for this theme project.')
  })

  test.each([
    {
      name: 'CLI store',
      flags: {store: 'unknown-store.myshopify.com'},
      argv: ['--store', 'unknown-store'],
      env: {},
      source: 'explicit-store' as const,
    },
    {
      name: 'environment-variable store',
      flags: {store: 'unknown-store.myshopify.com'},
      argv: [],
      env: {SHOPIFY_FLAG_STORE: 'unknown-store'},
      source: 'environment-variable' as const,
    },
  ])('rejects an unknown $name and exposes the attempted target', ({flags, argv, env, source}) => {
    const error = captureAirlockError(() => resolveSingle({flags, argv, env}))

    expect(error.reason).toBe('unknown-store')
    expect(error.targets).toEqual([
      {
        store: 'unknown-store.myshopify.com',
        source,
        implicit: false,
      },
    ])
    expect(error.message).toBe('Store unknown-store.myshopify.com is not configured for this theme project.')
  })

  test.each([
    {
      name: 'CLI store',
      flags: {store: 'candidate-store.myshopify.com'},
      argv: ['--store', 'candidate-store'],
      env: {},
    },
    {
      name: 'environment-variable store',
      flags: {store: 'candidate-store.myshopify.com'},
      argv: [],
      env: {SHOPIFY_FLAG_STORE: 'https://CANDIDATE-STORE.myshopify.com/admin/'},
    },
  ])('returns an untrusted normalized bootstrap candidate from a $name', ({flags, argv, env}) => {
    expect(resolveSingle({trust: unconfiguredTrust, flags, argv, env})).toEqual({
      bootstrap: true,
      candidate: 'candidate-store.myshopify.com',
      allowRememberedCandidate: false,
    })
  })

  test('allows a remembered candidate for an unconfigured bare command without returning one', () => {
    expect(resolveSingle({trust: unconfiguredTrust})).toEqual({
      bootstrap: true,
      allowRememberedCandidate: true,
    })
  })

  test.each([
    {
      name: 'CLI environment',
      flags: {environment: 'staging'},
      argv: ['-e', 'staging'],
      env: {},
    },
    {
      name: 'environment-variable environment',
      flags: {environment: 'staging'},
      argv: [],
      env: {SHOPIFY_FLAG_ENVIRONMENT: 'staging'},
    },
  ])('proposes an explicit $name during bootstrap', ({flags, argv, env}) => {
    expect(resolveSingle({trust: unconfiguredTrust, flags, argv, env})).toEqual({
      bootstrap: true,
      proposedEnvironment: 'staging',
      allowRememberedCandidate: false,
    })
  })

  test('normalizes selection and configured trust stores before comparing and returning them', () => {
    const trust: ThemeProjectTrust = {
      state: 'configured',
      path: '/theme/shopify.theme.toml',
      themePath: '/theme',
      environments: [{name: 'preview', store: 'https://PREVIEW-STORE.myshopify.com/admin/'}],
    }

    expect(
      resolveSingle({
        trust,
        flags: {store: 'preview-store.myshopify.com'},
        argv: ['--store', 'preview-store'],
      }),
    ).toEqual({
      environment: 'preview',
      store: 'preview-store.myshopify.com',
      source: 'explicit-store',
      implicit: false,
    })
  })

  test('uses only the supplied env object', () => {
    vi.stubEnv('SHOPIFY_FLAG_STORE', 'production-store')
    vi.stubEnv('SHOPIFY_FLAG_ENVIRONMENT', 'production')

    try {
      expect(resolveSingle({env: {}})).toEqual({
        environment: 'default',
        store: 'default-store.myshopify.com',
        source: 'default',
        implicit: true,
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('does not mutate any single-target input', () => {
    const trust: ThemeProjectTrust = {
      state: 'configured',
      path: '/theme/shopify.theme.toml',
      themePath: '/theme',
      environments: [{name: 'preview', store: 'PREVIEW-STORE'}],
    }
    const flags = {store: 'preview-store.myshopify.com', force: true, files: ['layout/theme.liquid']}
    const argv = ['--store', 'preview-store']
    const env = {SHOPIFY_FLAG_STORE: 'preview-store'}
    const originalInputs = structuredClone({trust, flags, argv, env})

    resolveSingleAirlockTarget({trust, flags, argv, env})

    expect({trust, flags, argv, env}).toEqual(originalInputs)
  })
})

describe('validateAirlockStoreSelectionSources', () => {
  test('rejects conflicting normalized CLI and environment-variable stores without reading process.env', () => {
    vi.stubEnv('SHOPIFY_FLAG_STORE', 'ignored-store')

    try {
      const flags = {store: 'cli-store.myshopify.com'}
      const argv = ['--store', 'https://CLI-STORE.myshopify.com/admin/']
      const env = {SHOPIFY_FLAG_STORE: 'environment-store'}
      const originalInputs = structuredClone({flags, argv, env})

      const error = captureAirlockError(() => validateAirlockStoreSelectionSources({flags, argv, env}))
      expect(error.reason).toBe('conflicting-selection')
      expect(error.message).toBe(
        'Store selections conflict: --store selects cli-store.myshopify.com, while SHOPIFY_FLAG_STORE selects environment-store.myshopify.com.',
      )
      expect({flags, argv, env}).toEqual(originalInputs)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test.each([
    {
      name: 'a CLI-only store',
      flags: {store: 'cli-store.myshopify.com'},
      argv: ['--store', 'cli-store'],
      env: {},
    },
    {
      name: 'an environment-variable-only store',
      flags: {},
      argv: [],
      env: {SHOPIFY_FLAG_STORE: 'environment-store'},
    },
    {
      name: 'matching normalized stores',
      flags: {store: 'cli-store.myshopify.com'},
      argv: ['--store', 'https://CLI-STORE.myshopify.com/admin/'],
      env: {SHOPIFY_FLAG_STORE: 'cli-store'},
    },
  ])('accepts $name', ({flags, argv, env}) => {
    expect(() => validateAirlockStoreSelectionSources({flags, argv, env})).not.toThrow()
  })
})

describe('resolveBatchAirlockTargets', () => {
  test('resolves multiple environments in request order after normalizing both sides', () => {
    const trust: ThemeProjectTrust = {
      state: 'configured',
      path: '/theme/shopify.theme.toml',
      themePath: '/theme',
      environments: [
        {name: 'preview', store: 'https://PREVIEW-STORE.myshopify.com/admin/'},
        {name: 'production', store: 'PRODUCTION-STORE'},
      ],
    }
    const environments = [
      {name: 'production', store: 'https://production-store.myshopify.com/admin/'},
      {name: 'preview', store: 'preview-store'},
    ]

    expect(resolveBatchAirlockTargets({trust, environments})).toEqual([
      {
        environment: 'production',
        store: 'production-store.myshopify.com',
        source: 'explicit-environment',
        implicit: false,
      },
      {
        environment: 'preview',
        store: 'preview-store.myshopify.com',
        source: 'explicit-environment',
        implicit: false,
      },
    ])
  })

  test.each([
    {
      name: 'an unknown environment',
      environments: [
        {name: 'preview', store: 'preview-store'},
        {name: 'staging', store: 'staging-store'},
      ],
      message: 'Invalid batch environment "staging": it is not configured for this theme project.',
    },
    {
      name: 'a missing requested store',
      environments: [{name: 'preview', store: 'preview-store'}, {name: 'production'}],
      message: 'Invalid batch environment "production": a store is required.',
    },
    {
      name: 'a mismatching requested store',
      environments: [
        {name: 'preview', store: 'preview-store'},
        {name: 'production', store: 'other-store'},
      ],
      message:
        'Invalid batch environment "production": other-store.myshopify.com does not match configured store production-store.myshopify.com.',
    },
  ])('rejects the whole batch when it contains $name', ({environments, message}) => {
    const error = captureAirlockError(() => resolveBatchAirlockTargets({trust: configuredTrust, environments}))

    expect(error.reason).toBe('invalid-batch')
    expect(error.targets).toEqual([])
    expect(error.message).toBe(message)
  })

  test('rejects a batch for an unconfigured project', () => {
    const error = captureAirlockError(() =>
      resolveBatchAirlockTargets({
        trust: unconfiguredTrust,
        environments: [{name: 'preview', store: 'preview-store'}],
      }),
    )

    expect(error.reason).toBe('unconfigured-project')
    expect(error.targets).toEqual([])
    expect(error.message).toBe("Can't resolve batch environments for an unconfigured theme project.")
  })

  test('does not mutate trust or requested environments', () => {
    const trust: ThemeProjectTrust = {
      state: 'configured',
      path: '/theme/shopify.theme.toml',
      themePath: '/theme',
      environments: [{name: 'preview', store: 'PREVIEW-STORE'}],
    }
    const environments = [{name: 'preview', store: 'https://preview-store.myshopify.com/admin/'}]
    const originalInputs = structuredClone({trust, environments})

    resolveBatchAirlockTargets({trust, environments})

    expect({trust, environments}).toEqual(originalInputs)
  })
})
