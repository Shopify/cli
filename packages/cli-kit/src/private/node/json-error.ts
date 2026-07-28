import {tokenItemToString, TokenItem} from './ui/components/TokenizedText.js'
import {outputResult, unstyled} from '../../public/node/output.js'
import {resolveJsonErrorType} from '../../public/node/error.js'
import type {TabularDataProps} from './ui/components/TabularData.js'
import type {EmittedJsonErrorType, JsonErrorType} from '../../public/node/error.js'
import type {AlertCustomSection} from '../../public/node/ui.js'

/**
 * A custom section flattened for JSON output. `body` is a plain string for token bodies and
 * a row-major matrix of strings for tabular ones.
 */
interface JsonErrorCustomSection {
  title?: string
  body: string | string[][]
}

/**
 * The `error` payload of the JSON error document.
 *
 * Absent fields are omitted rather than emitted as `null`, so consumers can test with a
 * simple presence check. `type` and `message` are always present.
 */
interface JsonErrorPayload {
  type: EmittedJsonErrorType
  message: string
  tryMessage?: string
  nextSteps?: string[]
  customSections?: JsonErrorCustomSection[]
  stack?: string
  command?: string
  args?: string[]
}

/**
 * The document written to stdout when a command fails with JSON output active.
 *
 * The single `error` key is what lets a script tell failure from success: successful
 * payloads in this CLI are bare values (arrays, or objects shaped by the command), so a
 * bare error object would force consumers to duck-type. This also matches oclif's and
 * npm's own JSON error shape.
 */
export interface JsonErrorDocument {
  error: JsonErrorPayload
}

/**
 * The subset of `FatalError` this module reads, with every field optional.
 *
 * Deliberately duck-typed rather than typed as `FatalError`: `isFatal` in `error.ts` also
 * duck-types, so errors reaching us may come from a different copy or version of cli-kit
 * and may not carry every field.
 */
interface FatalErrorLike {
  message?: string
  type?: number
  jsonErrorType?: JsonErrorType
  tryMessage?: TokenItem | null
  nextSteps?: TokenItem[]
  customSections?: AlertCustomSection[]
  stack?: string
  command?: string
  args?: string[]
}

function flattenTokenItem(token: TokenItem): string {
  return unstyled(tokenItemToString(token))
}

function isTabularData(body: AlertCustomSection['body']): body is TabularDataProps {
  return typeof body === 'object' && !Array.isArray(body) && 'tabularData' in body
}

function customSectionToJson(section: AlertCustomSection): JsonErrorCustomSection {
  const body = isTabularData(section.body)
    ? section.body.tabularData.map((row) => row.map(flattenTokenItem))
    : flattenTokenItem(section.body)

  return {
    ...(section.title === undefined ? {} : {title: section.title}),
    body,
  }
}

/**
 * Flattens a fatal error into the JSON document emitted when `--json` is active.
 *
 * Every nested `TokenItem` is reduced to a plain string with ANSI stripped; raw Ink/React
 * props never reach the payload. No exit code is included: `errorMapper` builds a new
 * `AbortError` that drops `oclif.exit`, so any code we read here could disagree with the
 * status the process actually exits with. The process exit status is the contract.
 *
 * @param error - The fatal error to flatten.
 * @returns The document to write, or `undefined` when the error is intentionally silent.
 */
export function fatalErrorToJsonDocument(error: FatalErrorLike): JsonErrorDocument | undefined {
  const type = resolveJsonErrorType(error)

  // `AbortSilentError` exists to terminate the process without printing anything, usually
  // after the user cancelled. Emitting a document for it would be a regression, so stay
  // silent in JSON mode too. `errorHandler` normally returns before we get here; this is
  // the fallback for an error built by a duplicate copy of cli-kit, where its `instanceof`
  // check does not hold.
  if (type === 'abortSilent') {
    return undefined
  }

  const tryMessage = error.tryMessage ?? undefined
  const {nextSteps, customSections} = error
  const hasNextSteps = nextSteps !== undefined && nextSteps.length > 0
  const hasCustomSections = customSections !== undefined && customSections.length > 0

  return {
    error: {
      type,
      message: unstyled(error.message ?? ''),
      ...(tryMessage === undefined ? {} : {tryMessage: flattenTokenItem(tryMessage)}),
      ...(hasNextSteps ? {nextSteps: nextSteps.map(flattenTokenItem)} : {}),
      ...(hasCustomSections ? {customSections: customSections.map(customSectionToJson)} : {}),
      // Only bugs ask the user to file a report, so they're the only type where a stack
      // trace is worth the payload size.
      ...(type === 'bug' && error.stack !== undefined ? {stack: unstyled(error.stack)} : {}),
      ...(error.command === undefined ? {} : {command: error.command}),
      ...(error.args === undefined ? {} : {args: error.args}),
    },
  }
}

/**
 * Writes the JSON error document for a fatal error to stdout.
 *
 * Goes through `outputResult` rather than `process.stdout.write` for two reasons: it is the
 * only stdout writer in the `output` family, so this matches how successful `--json`
 * payloads are emitted; and it is the only route the `mockAndCaptureOutput` test harness
 * can observe.
 *
 * @param error - The fatal error to write.
 */
export function renderFatalErrorAsJson(error: FatalErrorLike): void {
  const document = fatalErrorToJsonDocument(error)
  if (document !== undefined) {
    outputResult(JSON.stringify(document))
  }
}
