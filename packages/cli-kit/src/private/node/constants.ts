import {joinPath} from '../../public/node/path.js'
import envPaths from 'env-paths'

const identifier = 'shopify-cli'

const cacheFolder = () => {
  if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME
  return envPaths(identifier).cache
}

export const environmentVariables = {
  alwaysLogAnalytics: 'SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS',
  alwaysLogMetrics: 'SHOPIFY_CLI_ALWAYS_LOG_METRICS',
  deviceAuth: 'SHOPIFY_CLI_DEVICE_AUTH',
  enableCliRedirect: 'SHOPIFY_CLI_ENABLE_CLI_REDIRECT',
  env: 'SHOPIFY_CLI_ENV',
  firstPartyDev: 'SHOPIFY_CLI_1P_DEV',
  noAnalytics: 'SHOPIFY_CLI_NO_ANALYTICS',
  partnersToken: 'SHOPIFY_CLI_PARTNERS_TOKEN',
  runAsUser: 'SHOPIFY_RUN_AS_USER',
  serviceEnv: 'SHOPIFY_SERVICE_ENV',
  skipCliRedirect: 'SHOPIFY_CLI_SKIP_CLI_REDIRECT',
  spinInstance: 'SPIN_INSTANCE',
  themeToken: 'SHOPIFY_CLI_THEME_TOKEN',
  unitTest: 'SHOPIFY_UNIT_TEST',
  verbose: 'SHOPIFY_FLAG_VERBOSE',
  noThemeBundling: 'SHOPIFY_CLI_NO_THEME_BUNDLING',
  bundledThemeCLI: 'SHOPIFY_CLI_BUNDLED_THEME_CLI',
  // Variables to detect if the CLI is running in a cloud environment
  codespaces: 'CODESPACES',
  codespaceName: 'CODESPACE_NAME',
  codespacePortForwardingDomain: 'GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN',
  gitpod: 'GITPOD_WORKSPACE_URL',
  cloudShell: 'CLOUD_SHELL',
  spin: 'SPIN',
  spinAppPort: 'SERVER_PORT',
  spinAppHost: 'SPIN_APP_HOST',
  organization: 'SHOPIFY_CLI_ORGANIZATION',
  identityToken: 'SHOPIFY_CLI_IDENTITY_TOKEN',
  refreshToken: 'SHOPIFY_CLI_REFRESH_TOKEN',
  otelURL: 'SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT',
  themeKitAccessDomain: 'SHOPIFY_CLI_THEME_KIT_ACCESS_DOMAIN',
}

export const defaultThemeKitAccessDomain = 'theme-kit-access.shopifyapps.com'

export const systemEnvironmentVariables = {
  backendPort: 'BACKEND_PORT',
}

export const pathConstants = {
  executables: {
    dev: '/opt/dev/bin/dev',
  },
  directories: {
    cache: {
      path: () => {
        return cacheFolder()
      },
      vendor: {
        path: () => {
          return joinPath(cacheFolder(), 'vendor')
        },
        binaries: () => {
          return joinPath(cacheFolder(), 'vendor', 'binaries')
        },
      },
    },
  },
}

export const sessionConstants = {
  expirationTimeMarginInMinutes: 4,
}

export const bugsnagApiKey = '9e1e6889176fd0c795d5c659225e0fae'
