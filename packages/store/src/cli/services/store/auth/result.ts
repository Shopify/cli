import {outputCompleted, outputInfo, outputResult, outputToken, outputContent} from '@shopify/cli-kit/node/output'

export interface StoreAuthResult {
  store: string
  userId: string
  scopes: string[]
  acquiredAt: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  hasRefreshToken: boolean
  associatedUser?: {
    id: number
    email?: string
    firstName?: string
    lastName?: string
    accountOwner?: boolean
  }
}

type StoreAuthOutputFormat = 'text' | 'json'

interface ManualAuthUrlOptions {
  sensitive?: boolean
}

export interface StoreAuthPresenter {
  openingBrowser: () => void
  manualAuthUrl: (authorizationUrl: string, options?: ManualAuthUrlOptions) => boolean
  success: (result: StoreAuthResult) => void
}

function serializeStoreAuthResult(result: StoreAuthResult): string {
  return JSON.stringify(result, null, 2)
}

function buildStoreAuthSuccessText(result: StoreAuthResult): {completed: string[]; info: string[]} {
  const displayName = result.associatedUser?.email ? ` as ${result.associatedUser.email}` : ''

  return {
    completed: ['Logged in.', `Authenticated${displayName} against ${result.store}.`],
    info: [
      '',
      'To verify that authentication worked, run:',
      `shopify store execute --store ${result.store} --query 'query { shop { name id } }'`,
    ],
  }
}

function displayStoreAuthOpeningBrowser(): void {
  outputInfo('Shopify CLI will open the app authorization page in your browser.')
  outputInfo('')
}

// Callers mark a URL sensitive when they know why it is; this catches the signup credential even when
// they forget, and fails closed on anything it cannot parse well enough to clear.
function carriesSignupCredential(authorizationUrl: string): boolean {
  if (!URL.canParse(authorizationUrl)) return true
  return new URL(authorizationUrl).searchParams.has('signup')
}

function displayStoreAuthManualAuthUrl(authorizationUrl: string, options: ManualAuthUrlOptions = {}): boolean {
  if (options.sensitive || carriesSignupCredential(authorizationUrl)) {
    outputInfo(
      'Browser did not open automatically. The manual authorization URL contains sensitive credentials and was not printed.',
    )
    outputInfo('Run this command again in an environment where Shopify CLI can open a browser automatically.')
    outputInfo('')
    return false
  }

  outputInfo('Browser did not open automatically. Open this URL manually:')
  outputInfo(outputContent`${outputToken.link(authorizationUrl)}`)
  outputInfo('')

  return true
}

function displayStoreAuthResult(result: StoreAuthResult, format: StoreAuthOutputFormat = 'text'): void {
  if (format === 'json') {
    outputResult(serializeStoreAuthResult(result))
    return
  }

  const text = buildStoreAuthSuccessText(result)
  text.completed.forEach((line) => outputCompleted(line))
  text.info.forEach((line) => outputInfo(line))
}

export function createStoreAuthPresenter(format: StoreAuthOutputFormat = 'text'): StoreAuthPresenter {
  return {
    openingBrowser: displayStoreAuthOpeningBrowser,
    manualAuthUrl: displayStoreAuthManualAuthUrl,
    success(result: StoreAuthResult) {
      displayStoreAuthResult(result, format)
    },
  }
}
