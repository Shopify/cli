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
  const localFunctions = options.app.allExtensions.filter((ext) => ext.isFunctionExtension)

  const matchFunctions = await automaticMatchmaking(localFunctions, remoteFunctions, validIdentifiers, 'id')
  let validMatches = matchFunctions.identifiers

  const functionsToCreate = matchFunctions.toCreate ?? []

  for (const pending of matchFunctions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote, 'function')
    if (confirmed) {
      validMatches[pending.local.localIdentifier] = pending.remote.id
    } else {
      functionsToCreate.push(pending.local)
    }
  }

  let onlyRemoteFunctions = matchFunctions.toManualMatch.remote ?? []

  if (matchFunctions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchFunctions.toManualMatch, 'id')
    validMatches = {...validMatches, ...matchResult.identifiers}
    functionsToCreate.push(...matchResult.toCreate)
    onlyRemoteFunctions = matchResult.onlyRemote
  }

  if (!options.force) {
    const confirmed = await deployConfirmationPrompt(
      {
        appTitle: options.app.name,
        question: 'Make the following changes to your functions in Shopify Partners?',
        identifiers: validMatches,
        toCreate: functionsToCreate,
        onlyRemote: onlyRemoteFunctions,
        dashboardOnly: [],
      },
      options,
    )
    if (!confirmed) return err('user-cancelled')
  }

  return ok(validMatches)
}
