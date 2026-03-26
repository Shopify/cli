import {
  invalidAppValidationResult,
  stringifyAppValidationResult,
  validAppValidationResult,
} from './validation-result.js'
import {AppLinkedInterface} from '../models/app/app.js'
import metadata from '../metadata.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult, stringifyMessage} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {AppValidationIssue} from '../models/app/error-parsing.js'

interface ValidateAppOptions {
  json: boolean
}

function toRootIssue(filePath: string, message: string): AppValidationIssue {
  return {
    filePath,
    path: [],
    pathString: 'root',
    message,
  }
}

function normalizeStructuredMessage(message: string) {
  return message.trim().replace(/^App configuration is not valid\n/, '')
}

function getStructuredIssueLines(issues: AppValidationIssue[], startIndex: number) {
  return issues
    .slice(startIndex)
    .map((issue) => `• [${issue.pathString}]: ${issue.message}`)
    .join('\n')
}

// Some loader/config messages are just a rendered wrapper around the same
// structured issues. Detect that case so JSON mode doesn't duplicate them.
function isStructuredMessageEquivalent(message: string, issues: AppValidationIssue[]): boolean {
  if (issues.length === 0) return false

  const normalizedMessage = normalizeStructuredMessage(message)

  for (let startIndex = 0; startIndex < issues.length; startIndex++) {
    const issueLines = getStructuredIssueLines(issues, startIndex)

    if (normalizedMessage === issueLines) {
      return true
    }

    const isValidationWrapper = normalizedMessage.startsWith('Validation errors in ')
    if (isValidationWrapper && normalizedMessage.endsWith(`\n\n${issueLines}`)) {
      return true
    }
  }

  return false
}

function hasStructuredIssueListing(message: string, issues: AppValidationIssue[]): boolean {
  if (issues.length === 0) return false

  const normalizedMessage = normalizeStructuredMessage(message)

  for (let startIndex = 0; startIndex < issues.length; startIndex++) {
    const issueLines = getStructuredIssueLines(issues, startIndex)

    if (normalizedMessage === issueLines) {
      return true
    }

    const isValidationWrapper = normalizedMessage.startsWith('Validation errors in ')
    if (isValidationWrapper && normalizedMessage.includes(`\n\n${issueLines}`)) {
      return true
    }
  }

  return false
}

function toPublicIssues(app: AppLinkedInterface): AppValidationIssue[] {
  const structuredErrors = app.errors?.toStructuredJSON() ?? []

  return structuredErrors.flatMap(({filePath, message, issues}) => {
    const renderedMessage = stringifyMessage(message).trim()
    if (issues.length === 0) return [toRootIssue(filePath, renderedMessage)]
    if (isStructuredMessageEquivalent(renderedMessage, issues)) return issues
    return [...issues, toRootIssue(filePath, renderedMessage)]
  })
}

function toTelemetryIssues(app: AppLinkedInterface): AppValidationIssue[] {
  const structuredErrors = app.errors?.toStructuredJSON() ?? []

  return structuredErrors.flatMap(({filePath, message, issues}) => {
    const renderedMessage = stringifyMessage(message).trim()
    if (issues.length === 0) return [toRootIssue(filePath, renderedMessage)]
    if (hasStructuredIssueListing(renderedMessage, issues)) return issues
    return [...issues, toRootIssue(filePath, renderedMessage)]
  })
}

async function recordValidationMetadata(valid: boolean, issues: AppValidationIssue[]) {
  const distinctFileCount = new Set(issues.map((issue) => issue.filePath)).size

  await metadata.addPublicMetadata(() => ({
    cmd_app_validate_valid: valid,
    cmd_app_validate_issue_count: issues.length,
    cmd_app_validate_file_count: distinctFileCount,
  }))
}

export async function validateApp(app: AppLinkedInterface, options: ValidateAppOptions = {json: false}): Promise<void> {
  const errors = app.errors

  if (!errors || errors.isEmpty()) {
    await recordValidationMetadata(true, [])

    if (options.json) {
      outputResult(stringifyAppValidationResult(validAppValidationResult()))
      return
    }

    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const publicIssues = toPublicIssues(app)
  const telemetryIssues = toTelemetryIssues(app)
  const errorMessages = errors.toJSON().map((error) => stringifyMessage(error).trim())

  await recordValidationMetadata(false, telemetryIssues)

  if (options.json) {
    outputResult(stringifyAppValidationResult(invalidAppValidationResult(publicIssues)))
    throw new AbortSilentError()
  }

  renderError({
    headline: 'Validation errors found.',
    body: errorMessages.join('\n\n'),
  })

  throw new AbortSilentError()
}
