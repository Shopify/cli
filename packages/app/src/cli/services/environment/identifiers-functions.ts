import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, MatchingError, RemoteSource} from './identifiers.js'
import {matchConfirmationPrompt} from './prompts.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

export async function ensureFunctionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  remoteFunctions: RemoteSource[],
): Promise<Result<IdentifiersExtensions, MatchingError>> {
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localFunctions = options.app.extensions.function

  const matchFunctionsResult = await automaticMatchmaking(localFunctions, remoteFunctions, validIdentifiers, 'id')
  if (matchFunctionsResult.isErr()) return err(matchFunctionsResult.error)
  const matchFunctions = matchFunctionsResult.value
  let validMatches = matchFunctions.identifiers

  for (const pending of matchFunctions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote)
    if (!confirmed) return err('user-cancelled')
    validMatches[pending.local.localIdentifier] = pending.remote.id
  }

  if (matchFunctions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchFunctions.toManualMatch, 'id')
    if (matchResult.result === 'pending-remote') return err('pending-remote')
    validMatches = {...validMatches, ...matchResult.identifiers}
  }

  return ok(validMatches)
}
