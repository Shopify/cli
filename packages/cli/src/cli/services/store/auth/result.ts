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

export interface StoreAuthPresenter {
  openingBrowser: () => void
  manualAuthUrl: (authorizationUrl: string) => void
  success: (result: StoreAuthResult) => void
}

function serializeStoreAuthResult(result: StoreAuthResult): string {
  return JSON.stringify(result, null, 2)
}

function buildStoreAuthSuccessText(result: StoreAuthResult): {completed: string[]; info: string[]} {
  const displayName = result.associatedUser?.email ? ` as ${result.associatedUser.email}` : ''

  return {
    completed: ['Logged in.', `Authenticated${displayName} against ${result.store}.`],
    info: ['', 'To verify that authentication worked, run:', `shopify store execute --store ${result.store} --query 'query { shop { name id } }'`],
  }
}

function displayStoreAuthOpeningBrowser(): void {
  outputInfo('Shopify CLI will open the app authorization page in your browser.')
  outputInfo('')
}

function displayStoreAuthManualAuthUrl(authorizationUrl: string): void {
  outputInfo('Browser did not open automatically. Open this URL manually:')
  outputInfo(outputContent`${outputToken.link(authorizationUrl)}`)
  outputInfo('')
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
