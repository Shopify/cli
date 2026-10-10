import {FatalErrorType} from './index.js'
import {tokenItemToJsonString, type TokenItem} from '../../../private/node/ui/components/token-item.js'
import {unstyled} from '../output.js'
import type {JsonError, JsonErrorCustomSection, JsonErrorType} from './types.js'

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
  details?: unknown
  code?: unknown
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

/**
 * Projects an error into the shared JSON error contract, retaining only allowlisted fields.
 *
 * @param source - Error to project.
 * @returns The error classification, message, and available recovery information.
 */
export function errorToJson(source: unknown): JsonError {
  const error: FatalErrorLike = typeof source === 'object' && source !== null ? source : {message: source}

  const external = externalCommand(error)
  const type = jsonErrorType(error, external)
  const formattedMessage = jsonTokenItem(error.formattedMessage)
  const message = formattedMessage ?? (typeof error.message === 'string' ? unstyled(error.message) : 'Unknown error')
  const tryMessage = jsonTokenItem(error.tryMessage)
  const nextSteps = jsonTokenItems(error.nextSteps)
  const customSections = jsonCustomSections(error.customSections)
  const details = error.details

  const commonFields = {
    message,
    ...(typeof error.code === 'string' && error.code.length > 0 ? {code: error.code} : {}),
    ...(tryMessage === undefined ? {} : {tryMessage}),
    ...(nextSteps === undefined ? {} : {nextSteps}),
    ...(customSections === undefined ? {} : {customSections}),
    ...(details === undefined ? {} : {details}),
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

  return jsonError
}
