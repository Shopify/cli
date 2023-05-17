import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, MatchingError, RemoteSource} from './identifiers.js'
import {matchConfirmationPrompt, deployConfirmationPrompt} from './prompts.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'

export async function ensureFunctionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  remoteFunctions: RemoteSource[],
): Promise<Result<IdentifiersExtensions, MatchingError>> {
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localFunctions = options.app.extensions.function

  const matchFunctions = await automaticMatchmaking(localFunctions, remoteFunctions, validIdentifiers, 'id')
  let validMatches = matchFunctions.identifiers

  for (const pending of matchFunctions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote)
    if (!confirmed) return err('user-cancelled')
    validMatches[pending.local.localIdentifier] = pending.remote.id
  }

  const functionsToCreate = matchFunctions.toCreate ?? []
  let onlyRemoteFunctions = matchFunctions.toManualMatch.remote ?? []

  if (matchFunctions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchFunctions.toManualMatch, 'id')
    validMatches = {...validMatches, ...matchResult.identifiers}
    functionsToCreate.push(...matchResult.toCreate)
    onlyRemoteFunctions = matchResult.onlyRemote
  }

  if (!options.force) {
    const confirmed = await deployConfirmationPrompt({
      question: 'Make the following changes to your functions in Shopify Partners?',
      identifiers: validMatches,
      toCreate: functionsToCreate,
      onlyRemote: onlyRemoteFunctions,
      dashboardOnly: [],
    })
    if (!confirmed) return err('user-cancelled')
  }

  return ok(validMatches)
}
