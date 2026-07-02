import {findSessionIdByAlias} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export async function sessionIdFromAuthAlias(authAlias?: string): Promise<string | undefined> {
  if (!authAlias) return undefined

  const sessionId = await findSessionIdByAlias(authAlias)
  if (!sessionId) {
    throw new AbortError(
      outputContent`No authenticated account found for alias ${outputToken.yellow(authAlias)}.`,
      outputContent`Run ${outputToken.genericShellCommand(`shopify auth login --alias ${authAlias}`)} first.`,
    )
  }

  return sessionId
}
