import {tokenItemToString, type Token, type TokenItem} from './ui/components/token-item.js'
import {FatalErrorType} from '../../public/node/error.js'
import {jsonErrorOutputSchema} from '../../public/node/error/schema.js'
import {outputResult, unstyled} from '../../public/node/output.js'
import type {
  JsonError,
  JsonErrorCustomSection,
  JsonErrorDocument,
  JsonErrorType,
} from '../../public/node/error/types.js'

interface FatalErrorLike {
  type?: number
  message?: unknown
  formattedMessage?: unknown
  tryMessage?: unknown
  nextSteps?: unknown
  customSections?: unknown
  stack?: unknown
  command?: unknown
  args?: unknown
}

interface ExternalCommand {
  command: string
  args: string[]
}

function externalCommand(error: FatalErrorLike): ExternalCommand | undefined {
  if (typeof error.command !== 'string' || !Array.isArray(error.args)) return
  if (!error.args.every((arg) => typeof arg === 'string')) return

  return {command: error.command, args: error.args}
}

function jsonErrorType(error: FatalErrorLike, external: ExternalCommand | undefined): JsonErrorType {
  if (error.type === FatalErrorType.Abort) {
    return external ? 'external' : 'abort'
  }
  return 'bug'
}

function tokenToJsonString(token: Token): string {
  if (typeof token === 'string') return token

  if ('link' in token) {
    const {label, url} = token.link
    return label && label !== url ? `${label} (${url})` : url
  }

  if ('list' in token) {
    const title = token.list.title ? tokenItemToJsonString(token.list.title).trim() : undefined
    const items = token.list.items.map(tokenItemToJsonString).join('; ')
    return title ? `${title}${items ? `: ${items}` : ''}` : items
  }

  return tokenItemToString(token)
}

function tokenItemToJsonString(token: TokenItem): string {
  if (!Array.isArray(token)) return tokenToJsonString(token)

  return token
    .map((item, index) => {
      const value = tokenToJsonString(item)
      const needsLeadingSpace = index !== 0 && !(typeof item !== 'string' && 'char' in item)
      return needsLeadingSpace ? ` ${value}` : value
    })
    .join('')
}

function jsonTokenItem(token: unknown): string | undefined {
  if (token === null || token === undefined) return

  try {
    const message = tokenItemToJsonString(token as TokenItem)
    return typeof message === 'string' ? unstyled(message) : undefined
  } catch (error) {
    if (error instanceof TypeError) return undefined
    throw error
  }
}

function jsonTokenItems(items: unknown): string[] | undefined {
  if (!Array.isArray(items)) return

  const renderedItems = items.map(jsonTokenItem).filter((item): item is string => item !== undefined)
  return renderedItems.length > 0 ? renderedItems : undefined
}

function jsonTable(data: unknown): string[][] | undefined {
  if (!Array.isArray(data)) return

  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => jsonTokenItem(cell) ?? ''))
}

function jsonCustomSection(section: unknown): JsonErrorCustomSection | undefined {
  if (typeof section !== 'object' || section === null || !('body' in section)) return

  const title = 'title' in section && typeof section.title === 'string' ? unstyled(section.title) : undefined
  const sectionBody = section.body
  const body =
    typeof sectionBody === 'object' && sectionBody !== null && 'tabularData' in sectionBody
      ? jsonTable(sectionBody.tabularData)
      : jsonTokenItem(sectionBody)

  if (body === undefined) return
  return {...(title ? {title} : {}), body}
}

function jsonCustomSections(sections: unknown): JsonErrorCustomSection[] | undefined {
  if (!Array.isArray(sections)) return

  const renderedSections = sections
    .map(jsonCustomSection)
    .filter((section): section is JsonErrorCustomSection => section !== undefined)
  return renderedSections.length > 0 ? renderedSections : undefined
}

function jsonErrorDocument(error: FatalErrorLike): JsonErrorDocument | undefined {
  if (error.type === FatalErrorType.AbortSilent) return

  const external = externalCommand(error)
  const type = jsonErrorType(error, external)
  const formattedMessage = jsonTokenItem(error.formattedMessage)
  const message = formattedMessage ?? (typeof error.message === 'string' ? unstyled(error.message) : 'Unknown error')
  const tryMessage = jsonTokenItem(error.tryMessage)
  const nextSteps = jsonTokenItems(error.nextSteps)
  const customSections = jsonCustomSections(error.customSections)

  const commonFields = {
    message,
    ...(tryMessage === undefined ? {} : {tryMessage}),
    ...(nextSteps === undefined ? {} : {nextSteps}),
    ...(customSections === undefined ? {} : {customSections}),
  }

  let jsonError: JsonError
  if (type === 'bug') {
    jsonError = {
      type,
      ...commonFields,
      ...(typeof error.stack === 'string' ? {stack: unstyled(error.stack)} : {}),
    }
  } else if (type === 'external' && external) {
    jsonError = {type, ...commonFields, ...external}
  } else {
    jsonError = {type: 'abort', ...commonFields}
  }

  return {error: jsonError}
}

/**
 * Writes the public JSON representation of a fatal error to stdout.
 *
 * The allow-list mirrors the meaningful content of the regular fatal-error renderer.
 * Arbitrary error properties remain private and are never copied to stdout.
 *
 * @param error - Fatal error to serialize.
 */
export function renderFatalErrorAsJson(error: FatalErrorLike): void {
  const document = jsonErrorDocument(error)
  if (document) outputResult(JSON.stringify(jsonErrorOutputSchema.validate(document)))
}
