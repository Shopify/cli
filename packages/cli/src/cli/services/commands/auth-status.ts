import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {AuthStatus, getAuthStatus} from '@shopify/cli-kit/node/session'

function serializeAuthStatus(status: AuthStatus): string {
  return JSON.stringify(status, null, 2)
}

function displayAuthStatus(status: AuthStatus): void {
  switch (status.status) {
    case 'authenticated': {
      const account = status.account?.alias ?? status.account?.userId
      outputInfo(`Logged in as ${account}.`)
      return
    }
    case 'needs_refresh': {
      const account = status.account?.alias ?? status.account?.userId
      outputInfo(`Logged in as ${account}, but the session may refresh before use.`)
      return
    }
    case 'not_authenticated': {
      outputInfo('Not logged in. Run `shopify auth login`.')
      return
    }
    case 'invalid': {
      outputInfo('The saved Shopify CLI session is invalid. Run `shopify auth login`.')
    }
  }
}

export async function authStatusService(json: boolean): Promise<void> {
  const status = await getAuthStatus()

  if (json) {
    outputResult(serializeAuthStatus(status))
  } else {
    displayAuthStatus(status)
  }

  if (!status.authenticated) {
    process.exitCode = 1
  }
}
