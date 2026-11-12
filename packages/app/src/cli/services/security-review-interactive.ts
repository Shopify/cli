import {APP_SECURITY_SUPPRESSIONS_FILE_NAME} from './app-security-artifacts.js'
import {countLabel} from './app-security-format.js'
import {suppressionReasonProblem} from './app-security-suppressions.js'
import {interactiveFindingAlert, listedNumbers, renderAlert, savedNowAlert} from './security-review-output.js'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderConfirmationPrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import type {
  RenderConfirmationPromptOptions,
  RenderSelectPromptOptions,
  RenderTextPromptOptions,
} from '@shopify/cli-kit/node/ui'
import type {SuppressionKind} from './app-security-engine/index.js'
import type {SecurityReviewAlert} from './security-review-output.js'
import type {
  InteractiveReviewOutcome,
  InteractiveReviewSession,
  InteractiveSecurityReview,
  NumberedFinding,
  SavedReviewSuppressions,
  SuppressionRefusal,
} from './security-review.js'

type NumberedSavedSuppression = SavedReviewSuppressions['saved'][number]

/** What a person chooses for each finding of `review --interactive`. */
export type InteractiveReviewAction = 'suppress' | 'continue' | 'quit'

/** Whether `review --interactive` can prompt, and its prompts. Tests pass their own. */
export interface InteractiveReviewDependencies {
  canPrompt(): boolean
  selectAction(prompt: RenderSelectPromptOptions<InteractiveReviewAction>): Promise<InteractiveReviewAction>
  selectKind(prompt: RenderSelectPromptOptions<SuppressionKind>): Promise<SuppressionKind>
  enterReason(prompt: RenderTextPromptOptions): Promise<string>
  confirmCompanions(prompt: RenderConfirmationPromptOptions): Promise<boolean>
}

/**
 * Whether `review --interactive` can prompt: stdin, stdout and stderr are terminals, the terminal isn't `dumb`, the
 * command doesn't run in CI, and `--no-input` is off.
 */
export function canPromptInteractiveReview(): boolean {
  return terminalSupportsPrompting() && isTerminalInteractive()
}

const defaultInteractiveReviewDependencies: InteractiveReviewDependencies = {
  canPrompt: canPromptInteractiveReview,
  selectAction: (prompt) => renderSelectPrompt(prompt),
  selectKind: (prompt) => renderSelectPrompt(prompt),
  enterReason: (prompt) => renderTextPrompt(prompt),
  confirmCompanions: (prompt) => renderConfirmationPrompt(prompt),
}

/**
 * The session of `review --interactive`: for each active finding, most severe first, it shows the finding in full and
 * offers Suppress, Continue or Quit. Suppress asks for the kind and a reason and saves the entry at once; then, for an
 * agent finding with superseded deterministic companions, it asks separately whether to suppress them too. Aborts at
 * once when the terminal can't prompt, so the command fails before it reads anything, and never prompts in CI,
 * without a terminal, or with `--no-input`.
 */
export function interactiveSecurityReview(
  dependencies: InteractiveReviewDependencies = defaultInteractiveReviewDependencies,
): InteractiveSecurityReview {
  if (!dependencies.canPrompt()) {
    const error = new AbortError(
      'The interactive review needs an interactive terminal.',
      'Run it in a terminal, outside CI and without --no-input. To suppress a finding from a script or an agent, pass its number to --suppress with --kind and --reason.',
    )
    error.code = 'interactive-review-unavailable'
    throw error
  }
  return async (session) => {
    renderAlert(interactiveReviewIntroAlert(session))
    return reviewFindings(session, dependencies)
  }
}

/** What the session did for one finding. */
interface FindingDecision {
  saved: NumberedSavedSuppression[]
  /** The companions that the person chose not to suppress. */
  declinedCompanionNumbers: number[]
  /** A save was refused because the results changed, so the numbers may name other findings: the session stops. */
  resultsChanged: boolean
}

const NO_DECISION: FindingDecision = {saved: [], declinedCompanionNumbers: [], resultsChanged: false}

/** Offers each finding in order, and saves each decision before the next prompt. */
async function reviewFindings(
  session: InteractiveReviewSession,
  dependencies: InteractiveReviewDependencies,
): Promise<InteractiveReviewOutcome> {
  const outcome: InteractiveReviewOutcome = {saved: [], declinedCompanions: [], ending: 'finished'}
  for (const [position, numbered] of session.findings.entries()) {
    renderAlert(interactiveFindingAlert(numbered, position + 1, session.findings.length))
    // Each answer and save must finish before the next finding is offered.
    // eslint-disable-next-line no-await-in-loop
    const action = await dependencies.selectAction(interactiveActionPrompt(numbered))
    if (action === 'quit') return {...outcome, ending: 'quit'}
    if (action === 'continue') continue

    // eslint-disable-next-line no-await-in-loop
    const decision = await suppressInteractively(session, dependencies, numbered)
    outcome.saved.push(...decision.saved)
    if (decision.declinedCompanionNumbers.length > 0) {
      outcome.declinedCompanions.push({
        findingNumber: numbered.number,
        companionNumbers: decision.declinedCompanionNumbers,
      })
    }
    if (decision.resultsChanged) return {...outcome, ending: 'results-changed'}
  }
  return outcome
}

/**
 * Asks for the kind and the reason, and saves the entry at once. Then, when the finding has companions that
 * `check --blocking` still counts, asks whether to suppress them with the same kind and reason, and saves them only on
 * yes.
 */
async function suppressInteractively(
  session: InteractiveReviewSession,
  dependencies: InteractiveReviewDependencies,
  numbered: NumberedFinding,
): Promise<FindingDecision> {
  const kind = await dependencies.selectKind(suppressionKindPrompt(numbered))
  const reason = await dependencies.enterReason(suppressionReasonPrompt(numbered))
  const decision = {kind, reason}

  const finding = await session.suppress({findingNumber: numbered.number, decision, includeSuperseded: false})
  if (finding.status === 'refused') return showRefusal(finding.refusal)
  const {saved, companionNumbers} = finding.savedSuppressions
  renderAlert(savedNowAlert(saved))
  if (companionNumbers.length === 0) return {...NO_DECISION, saved}

  const confirmed = await dependencies.confirmCompanions(companionsPrompt(numbered, companionNumbers))
  if (!confirmed) return {...NO_DECISION, saved, declinedCompanionNumbers: companionNumbers}
  const companions = await session.suppress({findingNumber: numbered.number, decision, includeSuperseded: true})
  if (companions.status === 'refused') return {...showRefusal(companions.refusal), saved}
  renderAlert(savedNowAlert(companions.savedSuppressions.saved))
  return {...NO_DECISION, saved: [...saved, ...companions.savedSuppressions.saved]}
}

/** Shows why a save was refused. Nothing was saved for it; only a change of the results stops the session. */
function showRefusal(refusal: SuppressionRefusal): FindingDecision {
  const resultsChanged = refusal.code === 'results-digest-mismatch'
  renderAlert({
    type: resultsChanged ? 'error' : 'warning',
    options: {
      headline: refusal.message,
      body: resultsChanged
        ? 'The review stops here, and the suppressions you saved before are kept. Run the review again to see the current findings.'
        : refusal.tryMessage,
    },
  })
  return {...NO_DECISION, resultsChanged}
}

function interactiveReviewIntroAlert({findings}: InteractiveReviewSession): SecurityReviewAlert {
  if (findings.length === 0) {
    return {type: 'info', options: {headline: 'No active findings to review.'}}
  }
  return {
    type: 'info',
    options: {
      headline: `Reviewing ${countLabel(findings.length, 'active finding')}, most severe first.`,
      body: `For each finding, choose Suppress to save an entry for it to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} at once, Continue to leave it active, or Quit to stop. The suppressions you save apply to all app configurations and are kept when you quit.`,
    },
  }
}

function interactiveActionPrompt({number}: NumberedFinding): RenderSelectPromptOptions<InteractiveReviewAction> {
  return {
    message: `What do you want to do with finding #${number}?`,
    choices: [
      {label: 'Suppress', value: 'suppress', key: 's'},
      {label: 'Continue', value: 'continue', key: 'c'},
      {label: 'Quit', value: 'quit', key: 'q'},
    ],
    // Enter alone changes nothing: a suppression or a re-attachment needs its own key or a move of the cursor.
    defaultValue: 'continue',
  }
}

function suppressionKindPrompt({number}: NumberedFinding): RenderSelectPromptOptions<SuppressionKind> {
  return {
    message: `Is finding #${number} a false positive or an accepted risk?`,
    choices: [
      {label: 'False positive: the finding is wrong', value: 'false-positive'},
      {label: 'Accepted risk: the finding is real, and you accept the risk', value: 'accepted-risk'},
    ],
  }
}

/** The reason is required: an empty one is refused, and the prompt asks again. */
function suppressionReasonPrompt({number}: NumberedFinding): RenderTextPromptOptions {
  return {
    message: `Why should finding #${number} be suppressed?`,
    validate: (reason) => {
      const problem = suppressionReasonProblem(reason)
      return problem === undefined ? undefined : `The reason ${problem}.`
    },
  }
}

/** A separate yes or no for the companions, which defaults to no: they're saved only after an explicit yes. */
function companionsPrompt(
  {check, finding}: NumberedFinding,
  companionNumbers: number[],
): RenderConfirmationPromptOptions {
  const pronoun = companionNumbers.length === 1 ? 'it' : 'them'
  const companions =
    companionNumbers.length === 1
      ? `Finding #${companionNumbers[0]} is a superseded deterministic finding`
      : `Findings ${listedNumbers(companionNumbers.map((number) => `#${number}`))} are superseded deterministic findings`
  return {
    message: `${companions} of ${check.id} in ${finding.location.file}, and check --blocking, which reads no agent results, still counts ${pronoun}. Suppress ${pronoun} too, with the same kind and reason?`,
    confirmationMessage: `Yes, suppress ${pronoun} too`,
    cancellationMessage: 'No',
    defaultValue: false,
  }
}
