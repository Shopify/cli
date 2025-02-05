import {
  ciPlatform,
  hasGit,
  isDevelopment,
  isShopify,
  isUnitTest,
  analyticsDisabled,
  cloudEnvironment,
  macAddress,
  isAppManagementDisabled,
  getThemeKitAccessDomain,
  opentelemetryDomain,
} from './local.js'
import {getPartnersToken} from '../environment.js'
import {fileExists} from '../fs.js'
import {exec} from '../system.js'
import {expect, describe, vi, test} from 'vitest'

vi.mock('../fs.js')
vi.mock('../system.js')
vi.mock('../environment.js')

describe('isUnitTest', () => {
  test('returns true when SHOPIFY_UNIT_TEST is truthy', () => {
    // Given
    const env = {SHOPIFY_UNIT_TEST: '1'}

    // When
    const got = isUnitTest(env)

    // Then
    expect(got).toBe(true)
  })
})

describe('isDevelopment', () => {
  test('returns true when SHOPIFY_CLI_ENV is debug', () => {
    // Given
    const env = {SHOPIFY_CLI_ENV: 'development'}

    // When
    const got = isDevelopment(env)

    // Then
    expect(got).toBe(true)
  })
})

describe('isShopify', () => {
  test('returns false when the SHOPIFY_RUN_AS_USER env. variable is truthy', async () => {
    // Given
    const env = {SHOPIFY_RUN_AS_USER: '1'}

    // When
    await expect(isShopify(env)).resolves.toEqual(false)
  })

  test('returns true when the SHOPIFY_RUN_AS_USER env. variable is falsy', async () => {
    // Given
    const env = {SHOPIFY_RUN_AS_USER: '0'}

    // When
    await expect(isShopify(env)).resolves.toEqual(true)
  })

  test('returns true when dev is installed', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await expect(isShopify()).resolves.toBe(true)
  })

  test('returns true when it is a spin environment', async () => {
    // Given
    const env = {SPIN: '1'}

    // When
    await expect(isShopify(env)).resolves.toBe(true)
  })
})

describe('hasGit', () => {
  test('returns false if git --version errors', async () => {
    // Given
    vi.mocked(exec).mockRejectedValue(new Error('git not found'))

    // When
    const got = await hasGit()

    // Then
    expect(got).toBeFalsy()
  })

  test('returns true if git --version succeeds', async () => {
    // Given
    vi.mocked(exec).mockResolvedValue(undefined)

    // When
    const got = await hasGit()

    // Then
    expect(got).toBeTruthy()
  })
})

describe('isAppManagementDisabled', () => {
  test('returns true when a Partners token is present', () => {
    // Given
    vi.mocked(getPartnersToken).mockReturnValue('token')

    // When
    const got = isAppManagementDisabled()

    // Then
    expect(got).toBe(true)
  })

  test('returns false when a Partners token is not present', () => {
    // Given
    vi.mocked(getPartnersToken).mockReturnValue(undefined)

    // When
    const got = isAppManagementDisabled()

    // Then
    expect(got).toBe(false)
  })
})

describe('analitycsDisabled', () => {
  test('returns true when SHOPIFY_CLI_NO_ANALYTICS is truthy', () => {
    // Given
    const env = {SHOPIFY_CLI_NO_ANALYTICS: '1'}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(true)
  })

  test('returns true when in development', () => {
    // Given
    const env = {SHOPIFY_CLI_ENV: 'development'}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(true)
  })

  test('returns false without env variables', () => {
    // Given
    const env = {}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(false)
  })
})

describe('macAddress', () => {
  test('returns any mac address value', async () => {
    // When
    const got = await macAddress()

    // Then
    expect(got).not.toBeUndefined()
  })
})

describe('cloudEnvironment', () => {
  test('when spin environmentreturns correct cloud platform', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('spin')
  })

  test('when codespace environmentreturns correct cloud platform', () => {
    // Given
    const env = {CODESPACES: '1'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('codespaces')
  })

  test('when gitpod environmentreturns correct cloud platform', () => {
    // Given
    const env = {GITPOD_WORKSPACE_URL: 'http://custom.gitpod.io'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('gitpod')
  })

  test('returns localhost when no cloud enviroment varible exist', () => {
    // Given
    const env = {}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('localhost')
  })
})

describe('ciPlatform', () => {
  test('should return isCI false for non-CI environment', () => {
    // Given
    const nonCIResult = ciPlatform({})

    // Then
    expect(nonCIResult.isCI).toBe(false)
  })

  test('should return correct data for Bitbucket CI environment', () => {
    // Given
    const bitbucketEnv = {
      CI: 'true',
      BITBUCKET_BUILD_NUMBER: '123',
      BITBUCKET_BRANCH: 'main',
      BITBUCKET_COMMIT: 'abcdef',
      BITBUCKET_REPO_SLUG: 'some-repo',
      BITBUCKET_WORKSPACE: 'some-workspace',
    }

    // When
    const result = ciPlatform(bitbucketEnv)

    // Then
    expect(result).toEqual({
      isCI: true,
      name: 'bitbucket',
      metadata: {
        branch: 'main',
        build: '123',
        commitSha: 'abcdef',
        run: '123',
        url: 'https://bitbucket.org/some-workspace/some-repo/pipelines/results/123',
      },
    })
  })

  test('should return correct data for Github CI environment', () => {
    // Given
    const githubEnv = {
      CI: 'true',
      GITHUB_ACTION: '1',
      GITHUB_ACTOR: 'github_actor',
      GITHUB_REF_NAME: 'main',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_RUN_ID: '456',
      GITHUB_RUN_NUMBER: '789',
      GITHUB_SHA: 'abcdef',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'user/repo',
    }

    // When
    const result = ciPlatform(githubEnv)

    // Then
    expect(result).toEqual({
      isCI: true,
      name: 'github',
      metadata: {
        actor: 'github_actor',
        attempt: '1',
        branch: 'main',
        build: '456',
        commitSha: 'abcdef',
        run: '456',
        runNumber: '789',
        url: 'https://github.com/user/repo/actions/runs/456',
      },
    })
  })

  test('should return correct data for Azure CI environment', () => {
    // Given
    const azureEnv = {
      TF_BUILD: 'true',
    }

    // When
    const result = ciPlatform(azureEnv)

    // Then
    expect(result).toEqual({
      isCI: true,
      name: 'azure',
      metadata: {},
    })
  })
})

describe('getThemeKitAccessDomain', () => {
  test('returns default domain when env var not set', () => {
    // Given
    const env = {}

    // When
    const got = getThemeKitAccessDomain(env)

    // Then
    expect(got).toBe('theme-kit-access.shopifyapps.com')
  })

  test('returns custom domain when env var set', () => {
    // Given
    const env = {SHOPIFY_CLI_THEME_KIT_ACCESS_DOMAIN: 'theme-kit-staging.shopifyapps.com'}

    // When
    const got = getThemeKitAccessDomain(env)

    // Then
    expect(got).toBe('theme-kit-staging.shopifyapps.com')
  })
})

describe('opentelemetryDomain', () => {
  test('returns default domain when env var not set', () => {
    // Given
    const env = {}

    // When
    const got = opentelemetryDomain(env)

    // Then
    expect(got).toBe('https://otlp-http-production-cli.shopifysvc.com')
  })

  test('returns custom domain when env var set', () => {
    // Given
    const env = {SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT: 'custom-otel-domain.com'}

    // When
    const got = opentelemetryDomain(env)

    // Then
    expect(got).toBe('custom-otel-domain.com')
  })
})
