import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {checkStatusLabels, checksWithFindingsLabel, countLabel, listedNumbers} from './app-security-format.js'
import {APP_SECURITY_SUPPRESSIONS_FILE_NAME} from './app-security-artifacts.js'
import {suppressionReasonProblem, type SavedSuppression} from './app-security-suppressions.js'
import {
  SUPPRESSION_KIND_LABEL,
  suppressedFindingsView,
  unappliedEntriesView,
  type SuppressedFindingsView,
  type UnappliedEntriesView,
} from './security-suppressions-output.js'
import {
  activeFindings,
  isAgentResultStale,
  isCheckPassed,
  skippedFileCounts,
  summarizeCombinedChecks,
  type AppSecurityScope,
  type CombinedCheck,
  type CombinedChecksSummary,
  type CombinedFinding,
  type DeterministicFindingsDocument,
  type FindingsDocument,
  type FindingsSource,
  type Severity,
  type SourceCheckResult,
  type StoredCheckStatus,
  type SuppressionKind,
} from './app-security-engine/index.js'
import {timeAgo} from '@shopify/cli-kit/common/string'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {
  renderConfirmationPrompt,
  renderError,
  renderInfo,
  renderSelectPrompt,
  renderSuccess,
  renderTextPrompt,
  renderWarning,
} from '@shopify/cli-kit/node/ui'
import type {
  AlertCustomSection,
  InlineToken,
  RenderAlertOptions,
  RenderConfirmationPromptOptions,
  RenderSelectPromptOptions,
  RenderTextPromptOptions,
  Token,
  TokenItem,
} from '@shopify/cli-kit/node/ui'
import type {
  InteractiveReviewOutcome,
  InteractiveReviewSession,
  InteractiveSecurityReview,
  NumberedFinding,
  SavedReviewSuppressions,
  SecurityReviewResult,
  SuppressionRefusal,
} from './security-review.js'

/**
 * The terminal view of `app security review` (§9.4), and the session of `review --interactive`. The view-model functions
 * return data; only `renderSecurityReview` and the session touch the terminal, so tests assert on data plus a few
 * rendered checks, and drive the session with their own prompts.
 */

export interface SecurityReviewPresenterInput {
  result: SecurityReviewResult
  verbose: boolean
  now: Date
  commands: AppSecurityCommands
  /** What `--suppress` saved, shown after the review. */
  savedSuppressions?: SavedReviewSuppressions
  /** How the `--interactive` session ended and what it saved, shown after the review. */
  interactiveReview?: InteractiveReviewOutcome
}

/** The number of a finding of the review, which every finding has. */
type FindingNumberLookup = (finding: CombinedFinding) => number

type SecurityReviewAlertType = 'info' | 'success' | 'warning' | 'error'

interface SecurityReviewAlert {
  type: SecurityReviewAlertType
  options: RenderAlertOptions
}

interface ChecksWithFindingsRow {
  severity: string
  id: string
  /** Active findings per source, non-zero sources only: "1 deterministic, 2 agent". */
  counts: string
}

/** A results file is either missing, or present with its relative age and engine version. */
type ResultsFileRow =
  | {name: string; updated: 'not found'; engine?: never}
  | {name: string; updated: string; engine: string}

/** The summary closes with the next steps, or with the Blocking line when `--blocking` is breached. */
type SecurityReviewSummaryClosing =
  | {nextSteps: TokenItem<InlineToken>[]; blocking?: never}
  | {nextSteps?: never; blocking: string}

/** The summary box, always rendered last. Sections are undefined or empty when they don't apply. */
type SecurityReviewSummary = {
  type: SecurityReviewAlertType
  headline: string
  filterLine?: string
  checksWithFindings: ChecksWithFindingsRow[]
  otherChecks: string[]
  /** Present when a filtered check shows both sources because its agent result is stale. */
  staleAgentResults?: string
  coverage?: string
  /** The latest scan's directories and scope, and the scope the agent reported. Empty without any results file. */
  scopeLines: string[]
  scopeNote?: string
  resultsFiles: {directory: string; rows: ResultsFileRow[]}
  /** Present when a results file exists. */
  resultsDigest?: string
} & SecurityReviewSummaryClosing

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
/** A combined check's status: an executed check with no active findings has passed. */
const CHECK_STATUS_LABEL: Record<StoredCheckStatus, string> = {
  executed: 'passed',
  not_applicable: 'not applicable',
  unresolved: 'unresolved',
}
/** One source's own status: it executed, whatever the combined check's findings say. */
const SOURCE_STATUS_LABEL: Record<StoredCheckStatus, string> = {
  executed: 'executed',
  not_applicable: 'not applicable',
  unresolved: 'unresolved',
}
const SOURCE_ORDER: FindingsSource[] = ['deterministic', 'agent']
const FILE_NAMES: Record<FindingsSource, string> = {
  deterministic: 'deterministic-findings.json',
  agent: 'agent-findings.json',
}
const CONCISE_REASONING_LINES = 3
const SCOPE_DIFFERS_NOTE = 'Agent findings were recorded for a different scope than the latest scan.'
/** Marks a check whose `prefer-agent` agent result is older than the deterministic one, so both sources count. */
const STALE_AGENT_RESULT_MARKER = 'agent result stale'
const STALE_AGENT_RESULT_EXPLANATION = 'The agent result is older than the deterministic result, so both are shown.'

const renderers: Record<SecurityReviewAlertType, (options: RenderAlertOptions) => void> = {
  info: renderInfo,
  success: renderSuccess,
  warning: renderWarning,
  error: renderError,
}

export function renderSecurityReview(input: SecurityReviewPresenterInput): void {
  for (const alert of buildSecurityReviewAlerts(input)) {
    renderAlert(alert)
  }
}

function renderAlert(alert: SecurityReviewAlert): void {
  renderers[alert.type](alert.options)
}

/**
 * Every box in order: unresolved checks, passed checks, one per check with findings, the suppressed findings, the
 * entries of shopify.app-security.json that apply to nothing, the summary, then what `--suppress` or `--interactive`
 * saved. The suppressed findings box is shown whatever `--verbose`, whenever a shown check has one. The entries box is
 * shown whatever `--verbose`, whenever an entry of a shown check applies to nothing: `--check-id` narrows both boxes to
 * the selected checks. Each finding's title starts with its number.
 */
export function buildSecurityReviewAlerts(input: SecurityReviewPresenterInput): SecurityReviewAlert[] {
  const {checks, filter, suppressions} = input.result
  const numberOf: FindingNumberLookup = (finding) => input.result.findingNumbers.get(finding)!
  const supersededNumbers = supersededFindingNumbers(input.result)
  const unresolved = checks.filter((check) => check.status === 'unresolved' && activeFindings(check).length === 0)
  const passedOrNotApplicable = checks.filter(
    (check) => check.status !== 'unresolved' && activeFindings(check).length === 0,
  )
  const withFindings = checks.filter((check) => activeFindings(check).length > 0)
  const suppressed = suppressedFindingsView(checks, suppressions)
  // Not every entry's check is in the results, so the entries are narrowed by the selected IDs, not by the checks.
  const unappliedEntries = unappliedEntriesView(
    filter ? suppressions.filter((result) => filter.checkIds.includes(result.entry.check)) : suppressions,
  )

  return [
    ...(unresolved.length > 0 ? [unresolvedChecksAlert(unresolved, input.verbose, numberOf)] : []),
    ...(passedOrNotApplicable.length > 0 ? [passedChecksAlert(passedOrNotApplicable, input.verbose, numberOf)] : []),
    ...withFindings.map((check) => checkWithFindingsAlert(check, input.verbose, input.now, numberOf)),
    ...(suppressed ? [suppressedFindingsAlert(suppressed)] : []),
    ...(unappliedEntries ? [unappliedEntriesAlert(unappliedEntries)] : []),
    summaryAlert(buildSecurityReviewSummary(input)),
    ...(input.savedSuppressions ? [savedSuppressionsAlert(input.savedSuppressions, supersededNumbers)] : []),
    ...(input.interactiveReview ? [interactiveReviewOutcomeAlert(input.interactiveReview, supersededNumbers)] : []),
  ]
}

type NumberedSavedSuppression = SavedReviewSuppressions['saved'][number]

/**
 * The numbers of the superseded findings of every check. An entry doesn't change a finding's disposition, so a
 * superseded finding stays superseded after its entry is saved.
 */
function supersededFindingNumbers(result: SecurityReviewResult): ReadonlySet<number> {
  return new Set(
    [...result.findingNumbers].flatMap(([finding, number]) => (finding.disposition === 'superseded' ? [number] : [])),
  )
}

/**
 * One saved entry: its index, the finding it was saved for and the change, then what it holds. For a superseded
 * finding, a last line says why it needs an entry.
 */
function savedEntrySection(
  {index, change, entry, findingNumber}: NumberedSavedSuppression,
  supersededNumbers: ReadonlySet<number>,
): AlertCustomSection {
  return {
    title: `suppressions[${index}] · finding ${findingNumber} · ${change === 'added' ? 'added' : 'configuration added'}`,
    body: [
      `${entry.source} ${entry.check} in`,
      {filePath: entry.path},
      {subdued: `\nKind: ${SUPPRESSION_KIND_LABEL[entry.kind]}`},
      ...(entry.code === undefined ? [] : [{subdued: `\nCode: ${entry.code}`}]),
      {subdued: `\nReason: ${entry.reason}`},
      {subdued: `\nConfigurations: ${entry.configurations.join(', ')}`},
      ...(supersededNumbers.has(findingNumber) ? [`\n${supersededEntryLine(findingNumber)}`] : []),
    ],
  }
}

function supersededEntryLine(findingNumber: number): string {
  return `The agent result supersedes finding ${findingNumber} in the review, but check --blocking, which reads no agent results, counts it. This entry suppresses it for check --blocking.`
}

const COMMIT_SUPPRESSIONS_STEP: AlertCustomSection = {
  title: 'Next steps',
  body: {list: {items: [`Review and commit ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`]}},
}

function savedHeadline(saved: SavedSuppression[]): string {
  return `Saved ${countLabel(saved.length, 'suppression')} to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`
}

/** The entries that `--suppress` saved, then the companions it left out, and a reminder to commit the file. */
function savedSuppressionsAlert(
  {saved, companionNumbers}: SavedReviewSuppressions,
  supersededNumbers: ReadonlySet<number>,
): SecurityReviewAlert {
  const entrySections = saved.map((savedEntry) => savedEntrySection(savedEntry, supersededNumbers))
  const companionSections: AlertCustomSection[] =
    companionNumbers.length === 0
      ? []
      : [
          {
            title: 'Not suppressed',
            body: `${companionsLabel(companionNumbers)} the same check in the same file, so check --blocking, which reads no agent results, still counts ${
              companionNumbers.length === 1 ? 'it' : 'them'
            }. To suppress ${
              companionNumbers.length === 1 ? 'it' : 'them'
            } with the same kind and reason, run the command again with --include-superseded.`,
          },
        ]
  return {
    type: 'success',
    options: {
      headline: savedHeadline(saved),
      // A section rather than `nextSteps`, which a box draws before its sections: the entries come first.
      customSections: [...entrySections, ...companionSections, COMMIT_SUPPRESSIONS_STEP],
    },
  }
}

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
 * agent finding with superseded deterministic companions, it asks separately whether to suppress them too. After the
 * active findings, when there are any, it offers in the same way the superseded deterministic findings that
 * `check --blocking` still counts and that the session didn't already ask about as companions. Aborts at once when the
 * terminal can't prompt, so the command fails before it reads anything, and never prompts in CI, without a terminal,
 * or with `--no-input`.
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
    const active = await reviewFindingsFrom(session, dependencies, activeRound(session.findings), 0, {
      saved: [],
      declinedCompanions: [],
      ending: 'finished',
    })
    if (active.ending !== 'finished') return active
    const superseded = undecidedFindings(session.supersededFindings, active)
    if (superseded.length === 0) return active
    renderAlert(supersededFindingsIntroAlert(superseded))
    return reviewFindingsFrom(session, dependencies, supersededRound(superseded), 0, active)
  }
}

/** The findings that one part of the session offers, and how each finding's box counts them. */
interface ReviewRound {
  findings: NumberedFinding[]
  /** "Active finding 2 of 5", "Superseded finding 1 of 2". */
  progress(position: number): string
}

function activeRound(findings: NumberedFinding[]): ReviewRound {
  return {findings, progress: (position) => `Active finding ${position} of ${findings.length}`}
}

function supersededRound(findings: NumberedFinding[]): ReviewRound {
  return {findings, progress: (position) => `Superseded finding ${position} of ${findings.length}`}
}

/** The findings that the session didn't save or decline as the companions of an agent finding. */
function undecidedFindings(findings: NumberedFinding[], outcome: InteractiveReviewOutcome): NumberedFinding[] {
  const decided = new Set([
    ...outcome.saved.map(({findingNumber}) => findingNumber),
    ...outcome.declinedCompanions.flatMap(({companionNumbers}) => companionNumbers),
  ])
  return findings.filter(({number}) => !decided.has(number))
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

/** Offers the round's findings from `position` on, one at a time: each prompt waits for the answer to the one before. */
async function reviewFindingsFrom(
  session: InteractiveReviewSession,
  dependencies: InteractiveReviewDependencies,
  round: ReviewRound,
  position: number,
  outcome: InteractiveReviewOutcome,
): Promise<InteractiveReviewOutcome> {
  const numbered = round.findings[position]
  if (!numbered) return outcome

  renderAlert(interactiveFindingAlert(numbered, round.progress(position + 1)))
  const action = await dependencies.selectAction(interactiveActionPrompt(numbered))
  if (action === 'quit') return {...outcome, ending: 'quit'}
  const decision = action === 'suppress' ? await suppressInteractively(session, dependencies, numbered) : NO_DECISION
  const next: InteractiveReviewOutcome = {
    saved: [...outcome.saved, ...decision.saved],
    declinedCompanions:
      decision.declinedCompanionNumbers.length === 0
        ? outcome.declinedCompanions
        : [
            ...outcome.declinedCompanions,
            {findingNumber: numbered.number, companionNumbers: decision.declinedCompanionNumbers},
          ],
    ending: decision.resultsChanged ? 'results-changed' : 'finished',
  }
  if (decision.resultsChanged) return next
  return reviewFindingsFrom(session, dependencies, round, position + 1, next)
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
  const supersededNumbers = supersededFindingNumbers(session.result)
  renderAlert(savedNowAlert(saved, supersededNumbers))
  if (companionNumbers.length === 0) return {...NO_DECISION, saved}

  const confirmed = await dependencies.confirmCompanions(companionsPrompt(numbered, companionNumbers))
  if (!confirmed) return {...NO_DECISION, saved, declinedCompanionNumbers: companionNumbers}
  const companions = await session.suppress({findingNumber: numbered.number, decision, includeSuperseded: true})
  if (companions.status === 'refused') return {...showRefusal(companions.refusal), saved}
  renderAlert(savedNowAlert(companions.savedSuppressions.saved, supersededNumbers))
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

function interactiveReviewIntroAlert({findings, configuration}: InteractiveReviewSession): SecurityReviewAlert {
  if (findings.length === 0) {
    return {type: 'info', options: {headline: `No active findings to review for ${configuration}.`}}
  }
  return {
    type: 'info',
    options: {
      headline: `Reviewing ${countLabel(findings.length, 'active finding')} for ${configuration}, most severe first.`,
      body: `For each finding, choose Suppress to save an entry for it to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} at once, Continue to leave it active, or Quit to stop. The suppressions you save are kept when you quit.`,
    },
  }
}

/** Why the session offers the superseded findings, before the first of them. */
function supersededFindingsIntroAlert(findings: NumberedFinding[]): SecurityReviewAlert {
  const one = findings.length === 1
  const pronoun = one ? 'it' : 'them'
  return {
    type: 'info',
    options: {
      headline: `Reviewing ${countLabel(findings.length, 'superseded finding')} that check --blocking still ${
        one ? 'counts' : 'count'
      }.`,
      body: `An agent result supersedes ${
        one ? 'this deterministic finding' : 'these deterministic findings'
      }, so the review doesn't count ${pronoun}. But check --blocking, which reads no agent results, still counts ${pronoun}, so a CI gate that runs it can fail. Choose Suppress, Continue or Quit for each finding, as before.`,
    },
  }
}

/** The finding in full, with its evidence and reasoning, in the box of its check. */
function interactiveFindingAlert({number, check, finding}: NumberedFinding, progress: string): SecurityReviewAlert {
  return {
    type: check.severity === 'high' ? 'error' : 'warning',
    options: {
      headline: `${SEVERITY_LABEL[check.severity]} · ${check.id} · ${check.title}`,
      body: {subdued: progress},
      ...(check.docs_url ? {link: {label: `${check.id} on shopify.dev`, url: check.docs_url}} : {}),
      customSections: [findingSection(finding, number, true)],
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

/** What one decision saved, shown at once. */
function savedNowAlert(saved: NumberedSavedSuppression[], supersededNumbers: ReadonlySet<number>): SecurityReviewAlert {
  return {
    type: 'success',
    options: {
      headline: savedHeadline(saved),
      customSections: saved.map((savedEntry) => savedEntrySection(savedEntry, supersededNumbers)),
    },
  }
}

/** After the review: everything the session saved, the companions left out, how it ended, and the next step. */
function interactiveReviewOutcomeAlert(
  {saved, declinedCompanions, ending}: InteractiveReviewOutcome,
  supersededNumbers: ReadonlySet<number>,
): SecurityReviewAlert {
  const endingLines = {
    finished: undefined,
    quit: 'You quit the review. The suppressions you saved are kept.',
    'results-changed': 'The review stopped because the results changed. The suppressions you saved are kept.',
  }
  const endingLine = endingLines[ending]
  const body = endingLine === undefined ? {} : {body: endingLine}
  if (saved.length === 0) {
    return {
      type: 'info',
      options: {headline: `No suppressions saved to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`, ...body},
    }
  }
  const declinedSections: AlertCustomSection[] =
    declinedCompanions.length === 0
      ? []
      : [{title: 'Not suppressed', body: {list: {items: declinedCompanions.map(declinedCompanionsItem)}}}]
  return {
    type: 'success',
    options: {
      headline: savedHeadline(saved),
      ...body,
      customSections: [
        ...saved.map((savedEntry) => savedEntrySection(savedEntry, supersededNumbers)),
        ...declinedSections,
        COMMIT_SUPPRESSIONS_STEP,
      ],
    },
  }
}

function declinedCompanionsItem({
  findingNumber,
  companionNumbers,
}: InteractiveReviewOutcome['declinedCompanions'][number]): string {
  const pronoun = companionNumbers.length === 1 ? 'it' : 'them'
  return `${companionsLabel(companionNumbers)} the same check in the same file as finding ${findingNumber}, so check --blocking, which reads no agent results, still counts ${pronoun}. To suppress ${pronoun}, run the review with --suppress ${findingNumber} --include-superseded and the same --kind and --reason.`
}

/** "Finding 7 is a superseded deterministic finding of", "Findings 7 and 8 are superseded deterministic findings of". */
function companionsLabel(numbers: number[]): string {
  if (numbers.length === 1) return `Finding ${numbers[0]} is a superseded deterministic finding of`
  return `Findings ${listedNumbers(numbers)} are superseded deterministic findings of`
}

function suppressedFindingsAlert({headline, counts, sections}: SuppressedFindingsView): SecurityReviewAlert {
  return {type: 'info', options: {headline, customSections: [{body: counts}, ...sections]}}
}

/** A warning when an entry needs a change. Like every box, it doesn't change the exit code or `--blocking`. */
function unappliedEntriesAlert({headline, needsChange, sections}: UnappliedEntriesView): SecurityReviewAlert {
  return {type: needsChange ? 'warning' : 'info', options: {headline, customSections: sections}}
}

export function buildSecurityReviewSummary(input: SecurityReviewPresenterInput): SecurityReviewSummary {
  const {result} = input
  const anyFilePresent = result.sources.deterministic !== null || result.sources.agent !== null
  const summary = summarizeCombinedChecks(result.checks)
  const deterministic = result.sources.deterministic?.document
  const breached = result.blocking.blockedChecks > 0
  const staleChecks = result.checks.filter(isAgentResultStale).length

  return {
    type: summaryAlertType(result.checks, summary, anyFilePresent),
    headline: summaryHeadline(result.checks, summary, anyFilePresent),
    ...(result.filter && anyFilePresent
      ? {filterLine: `Showing ${result.checks.length} of ${result.allChecks.length} checks (--check-id).`}
      : {}),
    checksWithFindings: result.checks.filter((check) => activeFindings(check).length > 0).map(checksWithFindingsRow),
    otherChecks: otherChecksLines(summary),
    ...(staleChecks > 0 ? {staleAgentResults: staleAgentResultsLine(staleChecks)} : {}),
    ...(deterministic ? {coverage: coverageLine(deterministic)} : {}),
    scopeLines: scopeLines(result.sources),
    ...(result.scopeDiffers ? {scopeNote: SCOPE_DIFFERS_NOTE} : {}),
    resultsFiles: {
      directory: result.resultsDirectory,
      rows: SOURCE_ORDER.map((source) => resultsFileRow(source, result.sources[source]?.document, input.now)),
    },
    ...(result.resultsDigest === null ? {} : {resultsDigest: result.resultsDigest}),
    ...(breached
      ? {
          blocking: `${countLabel(result.blocking.blockedChecks, 'check')} at or above ${result.blocking.level} (--blocking ${
            result.blocking.level
          }).`,
        }
      : {nextSteps: nextSteps(result, summary, anyFilePresent, staleChecks, input.commands)}),
  }
}

function staleAgentResultsLine(staleChecks: number): string {
  const verb = staleChecks === 1 ? 'shows' : 'show'
  return `${countLabel(staleChecks, 'check')} ${verb} both sources because the agent results are older than the deterministic results.`
}

/** Mirrors `securityAlertType` in security-output.ts, with `info` for the no-results state. */
function summaryAlertType(
  checks: CombinedCheck[],
  summary: CombinedChecksSummary,
  anyFilePresent: boolean,
): SecurityReviewAlertType {
  if (!anyFilePresent) return 'info'
  if (checks.some((check) => check.severity === 'high' && activeFindings(check).length > 0)) return 'error'
  if (summary.withFindings > 0 || summary.unresolved > 0) return 'warning'
  return 'success'
}

function summaryHeadline(checks: CombinedCheck[], summary: CombinedChecksSummary, anyFilePresent: boolean): string {
  if (!anyFilePresent) return 'No app security check results to review.'
  if (summary.withFindings === 0) return `No findings in ${countLabel(checks.length, 'check')}.`
  const unresolved = summary.unresolved > 0 ? ` ${countLabel(summary.unresolved, 'check')} unresolved.` : ''
  return `${checksWithFindingsLabel(summary)}.${unresolved}`
}

function checksWithFindingsRow(check: CombinedCheck): ChecksWithFindingsRow {
  return {severity: SEVERITY_LABEL[check.severity], id: check.id, counts: activeCountsBySource(check)}
}

function activeCountsBySource(check: CombinedCheck): string {
  const active = activeFindings(check)
  return SOURCE_ORDER.map((source) => [source, active.filter((finding) => finding.source === source).length] as const)
    .filter(([, total]) => total > 0)
    .map(([source, total]) => `${total} ${source}`)
    .join(', ')
}

function otherChecksLines(summary: CombinedChecksSummary): string[] {
  return [joinParts(checkStatusLabels(summary)), dispositionCounts(summary)].filter((line) => line !== '')
}

function dispositionCounts(counts: {suppressed: number; superseded: number}): string {
  return joinParts([
    counts.suppressed > 0 ? `${countLabel(counts.suppressed, 'finding')} suppressed` : undefined,
    counts.superseded > 0 ? `${countLabel(counts.superseded, 'finding')} superseded` : undefined,
  ])
}

/** The suppressed and superseded counts of one check, or an empty string when it has neither. */
function checkDispositionCounts(check: CombinedCheck): string {
  return dispositionCounts(summarizeCombinedChecks([check]))
}

function joinParts(parts: (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined).join(' · ')
}

function coverageLine(document: DeterministicFindingsDocument): string {
  const skipped = document.coverage.files_skipped
  const {too_large: tooLarge, unreadable} = skippedFileCounts(skipped)
  const reasons = [
    tooLarge > 0 ? `${tooLarge} too large` : undefined,
    unreadable > 0 ? `${unreadable} unreadable` : undefined,
  ].filter((reason) => reason !== undefined)
  const skippedText = skipped.length === 0 ? 'none skipped' : `${skipped.length} skipped (${reasons.join(', ')})`

  const unsupported = document.detection.languages.filter((language) => language.support === 'unsupported')
  const languagesText =
    unsupported.length === 0
      ? ''
      : ` Unsupported ${unsupported.length === 1 ? 'language' : 'languages'}: ${unsupported
          .map((language) => `${language.name} (${countLabel(language.files.length, 'file')})`)
          .join(', ')}.`

  return `Deterministic coverage: ${countLabel(document.coverage.files_scanned, 'file')} scanned, ${skippedText}.${languagesText}`
}

function formatScope(scope: AppSecurityScope): string {
  const flags = [
    ...scope.include_dirs.map((includeDir) => `--include-dir ${includeDir}`),
    ...scope.excludes.map((excludePattern) => `--exclude ${excludePattern}`),
    ...(scope.no_git_ignore ? ['--no-git-ignore'] : []),
  ]
  return flags.length === 0 ? 'none' : flags.join(' ')
}

function scopeLines({deterministic, agent}: SecurityReviewResult['sources']): string[] {
  return [
    ...(deterministic
      ? [
          `Scan directories: ${deterministic.document.coverage.scan_directories.map(({directory}) => directory).join(', ')}`,
          `Scan scope: ${formatScope(deterministic.document.coverage.scope)}`,
        ]
      : []),
    ...(agent ? [`Scope reported by the agent: ${formatScope(agent.document.scope)}`] : []),
  ]
}

function resultsFileRow(source: FindingsSource, document: FindingsDocument | undefined, now: Date): ResultsFileRow {
  const name = FILE_NAMES[source]
  if (!document) return {name, updated: 'not found'}
  return {
    name,
    updated: formatAge(document.generated_at, now),
    engine: document.engine.version,
  }
}

function formatAge(timestamp: string, now: Date): string {
  const time = Date.parse(timestamp)
  if (Number.isNaN(time)) return 'unknown'
  return timeAgo(new Date(time), now)
}

function nextSteps(
  result: SecurityReviewResult,
  summary: CombinedChecksSummary,
  anyFilePresent: boolean,
  staleChecks: number,
  commands: AppSecurityCommands,
): TokenItem<InlineToken>[] {
  const checkCommand = {command: formatAppSecurityCommand(commands.scan)}
  if (!anyFilePresent) return [['Run', checkCommand, 'or have your coding agent run it.']]

  const steps: TokenItem<InlineToken>[] = []
  // `check` rewrites deterministic-findings.json but never touches agent-findings.json; only the agent does.
  if (summary.withFindings > 0) {
    const fixStep: InlineToken[] = ['Fix the issues, then run', checkCommand, 'again.']
    if (result.sources.agent === null) {
      steps.push(fixStep, 'For a deeper review, have your agent run the same command and record its findings.')
    } else if (staleChecks > 0) {
      // The stale step below says how to refresh the agent findings.
      steps.push(fixStep)
    } else {
      steps.push([...fixStep, 'To refresh agent findings, have your agent run the command and record its findings.'])
    }
  }
  // A stale check needs agent-findings.json, so this step never meets the deeper-review one.
  if (staleChecks > 0) {
    steps.push([
      'Agent results are older than the deterministic results. Have your coding agent run',
      checkCommand,
      'and record its findings again to refresh them.',
    ])
  } else if (summary.withFindings === 0 && result.sources.agent === null) {
    steps.push(['For a deeper review, have your coding agent run', checkCommand, {char: '.'}])
  }
  return steps
}

function summaryAlert(summary: SecurityReviewSummary): SecurityReviewAlert {
  const sections: AlertCustomSection[] = []
  if (summary.filterLine) sections.push({body: {subdued: summary.filterLine}})
  if (summary.checksWithFindings.length > 0) {
    sections.push({
      title: 'Checks with findings',
      body: {
        tabularData: summary.checksWithFindings.map((row) => [row.severity, row.id, row.counts]),
        firstColumnSubdued: true,
      },
    })
  }
  if (summary.otherChecks.length > 0) sections.push({title: 'Other checks', body: summary.otherChecks.join('\n')})
  if (summary.staleAgentResults) sections.push({body: summary.staleAgentResults})
  if (summary.coverage) sections.push({body: {subdued: summary.coverage}})
  if (summary.scopeLines.length > 0) sections.push({body: {subdued: summary.scopeLines.join('\n')}})
  if (summary.scopeNote) sections.push({body: summary.scopeNote})
  sections.push({
    title: `Results files in ${summary.resultsFiles.directory}`,
    body: {
      tabularData: [
        ['', {subdued: 'Updated'}, {subdued: 'Engine'}],
        ...summary.resultsFiles.rows.map(resultsFileCells),
      ],
    },
  })
  if (summary.resultsDigest) {
    sections.push({
      body: {subdued: `Results digest: ${summary.resultsDigest} (pass it to --results-digest with --suppress)`},
    })
  }
  if (summary.blocking === undefined) {
    // Nothing left to suggest when both result files are present and no check has findings or is stale.
    if (summary.nextSteps.length > 0) sections.push({title: 'Next steps', body: {list: {items: summary.nextSteps}}})
  } else {
    sections.push({title: 'Blocking', body: summary.blocking})
  }

  return {type: summary.type, options: {headline: summary.headline, customSections: sections}}
}

function resultsFileCells(row: ResultsFileRow): InlineToken[] {
  if (row.engine === undefined) return [row.name, {subdued: row.updated}]
  return [row.name, row.updated, row.engine]
}

/**
 * Unresolved checks with no active findings. With `--verbose`, each check's suppressed and superseded findings
 * follow it in full, prefixed by the check ID, as in the passed checks box.
 */
function unresolvedChecksAlert(
  checks: CombinedCheck[],
  verbose: boolean,
  numberOf: FindingNumberLookup,
): SecurityReviewAlert {
  return {
    type: 'warning',
    options: {
      headline: `${countLabel(checks.length, 'check')} unresolved.`,
      customSections: checks.flatMap((check) => [
        {
          title: `${check.id} · ${check.title}`,
          body: {tabularData: sourceStatusRows(check, {withDispositions: true}), firstColumnSubdued: true},
        },
        ...(verbose
          ? check.findings.map((finding) => findingSection(finding, numberOf(finding), verbose, `${check.id} · `))
          : []),
      ]),
    },
  }
}

/**
 * Passed and not applicable checks in one table. These checks have no active findings, so with
 * `--verbose` their suppressed and superseded findings are listed here in full, prefixed by the check ID.
 */
function passedChecksAlert(
  checks: CombinedCheck[],
  verbose: boolean,
  numberOf: FindingNumberLookup,
): SecurityReviewAlert {
  const passed = checks.filter(isCheckPassed).length
  const notApplicable = checks.length - passed
  const headline = [
    passed > 0 ? `${countLabel(passed, 'check')} passed.` : undefined,
    notApplicable > 0 ? `${countLabel(notApplicable, 'check')} not applicable.` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(' ')

  return {
    type: 'info',
    options: {
      headline,
      customSections: [
        {
          // Two columns: with the longest check IDs, a third column for the counts would overflow the box.
          body: {
            tabularData: checks.map(passedCheckRow),
          },
        },
        ...(verbose
          ? checks.flatMap((check) =>
              check.findings.map((finding) => findingSection(finding, numberOf(finding), verbose, `${check.id} · `)),
            )
          : []),
      ],
    },
  }
}

/** The check ID, then its status with the suppressed and superseded counts and the stale marker when they apply. */
function passedCheckRow(check: CombinedCheck): InlineToken[] {
  const counts = checkDispositionCounts(check)
  return [
    check.id,
    joinParts([
      CHECK_STATUS_LABEL[check.status],
      counts === '' ? undefined : counts,
      isAgentResultStale(check) ? STALE_AGENT_RESULT_MARKER : undefined,
    ]),
  ]
}

/**
 * The statuses are shown when the sources disagree, and always for a stale check: there both results count,
 * so each comes with its age and a line says why.
 */
function checkWithFindingsAlert(
  check: CombinedCheck,
  verbose: boolean,
  now: Date,
  numberOf: FindingNumberLookup,
): SecurityReviewAlert {
  const counts = checkDispositionCounts(check)
  const findings = verbose ? check.findings : activeFindings(check)

  return {
    type: check.severity === 'high' ? 'error' : 'warning',
    options: {
      headline: `${SEVERITY_LABEL[check.severity]} · ${check.id} · ${check.title}`,
      ...(counts === '' ? {} : {body: {subdued: counts}}),
      ...(check.docs_url ? {link: {label: `${check.id} on shopify.dev`, url: check.docs_url}} : {}),
      customSections: [
        ...sourceStatusSections(check, now),
        ...findings.map((finding) => findingSection(finding, numberOf(finding), verbose)),
      ],
    },
  }
}

/**
 * For a stale check, both sources' statuses with their ages, then the explanation. Otherwise the statuses alone
 * when the sources disagree, and nothing when they agree.
 */
function sourceStatusSections(check: CombinedCheck, now: Date): AlertCustomSection[] {
  if (isAgentResultStale(check)) {
    const rows = SOURCE_ORDER.flatMap((source) => {
      const result = check.by_source[source]
      return result ? [[source, sourceStatusText(result), formatAge(result.generated_at, now)]] : []
    })
    return [{body: {tabularData: rows, firstColumnSubdued: true}}, {body: {subdued: STALE_AGENT_RESULT_EXPLANATION}}]
  }
  const {deterministic, agent} = check.by_source
  const sourcesDiffer = deterministic !== null && agent !== null && deterministic.status !== agent.status
  if (sourcesDiffer) {
    return [{body: {tabularData: sourceStatusRows(check, {withDispositions: false}), firstColumnSubdued: true}}]
  }
  return []
}

/**
 * One row per present source: its status and, for unresolved and not applicable results, the reason. A stale
 * agent result carries the stale marker.
 */
function sourceStatusRows(check: CombinedCheck, options: {withDispositions: boolean}): InlineToken[][] {
  const stale = isAgentResultStale(check)
  const rows = SOURCE_ORDER.flatMap((source) => {
    const result = check.by_source[source]
    if (!result) return []
    const marker = stale && source === 'agent' ? STALE_AGENT_RESULT_MARKER : undefined
    return [[source, joinParts([sourceStatusText(result), marker])]]
  })
  const counts = options.withDispositions ? checkDispositionCounts(check) : ''
  return counts === '' ? rows : [...rows, ['findings', counts]]
}

function sourceStatusText(result: SourceCheckResult): string {
  const status = SOURCE_STATUS_LABEL[result.status]
  return result.reason ? `${status} — ${result.reason.message}` : status
}

function findingSection(
  finding: CombinedFinding,
  number: number,
  verbose: boolean,
  titlePrefix = '',
): AlertCustomSection {
  const disposition = finding.disposition === 'active' ? '' : ` (${finding.disposition})`
  const details: Token[] = [finding.message]
  if (finding.snippet) details.push({subdued: `\nCode: ${finding.snippet}`})
  if (finding.source === 'deterministic') {
    if (finding.fix) details.push({subdued: `\nFix: ${finding.fix.description}`})
    const guide = finding.fix?.guide
    if (guide) details.push({subdued: `\nGuide: ${guide}`})
  } else {
    if (finding.confidence) details.push({subdued: `\nConfidence: ${finding.confidence}`})
    if (finding.reasoning)
      details.push({subdued: `\nReasoning: ${verbose ? finding.reasoning : conciseReasoning(finding.reasoning)}`})
  }
  if (verbose) {
    details.push(
      ...finding.evidence.map((evidence) => ({
        subdued: `\nEvidence: ${formatLocation(evidence.location)}${evidence.quote ? ` — ${evidence.quote}` : ''}`,
      })),
    )
    // `suppressed_by` is the entry or the agent suppression that applies, so a hand-edited one stays silent.
    if (finding.disposition === 'suppressed' && finding.suppressed_by) {
      details.push({subdued: `\nSuppressed: ${finding.suppressed_by.reason}`})
    }
  }
  return {
    title: `${titlePrefix}#${number} · ${finding.source} · ${formatLocation(finding.location)}${disposition}`,
    body: details,
  }
}

function conciseReasoning(reasoning: string): string {
  const lines = reasoning.split('\n')
  if (lines.length <= CONCISE_REASONING_LINES) return reasoning
  return `${lines.slice(0, CONCISE_REASONING_LINES).join('\n')}…`
}

function formatLocation(location: CombinedFinding['location']): string {
  return location.line === undefined ? location.file : `${location.file}:${location.line}`
}
