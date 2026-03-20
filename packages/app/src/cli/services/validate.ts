import {AppLinkedInterface} from '../models/app/app.js'
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

function isStructuredMessageEquivalent(message: string, issues: AppValidationIssue[]): boolean {
  if (issues.length === 0) return false

  const normalizedMessage = message.trim().replace(/^App configuration is not valid\n/, '')

  for (let startIndex = 0; startIndex < issues.length; startIndex++) {
    const issueLines = issues
      .slice(startIndex)
      .map((issue) => `• [${issue.pathString}]: ${issue.message}`)
      .join('\n')

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

function toPublicIssues(app: AppLinkedInterface): AppValidationIssue[] {
  const structuredErrors = app.errors?.toStructuredJSON() ?? []

  return structuredErrors.flatMap(({filePath, message, issues}) => {
    const renderedMessage = stringifyMessage(message).trim()
    if (issues.length === 0) return [toRootIssue(filePath, renderedMessage)]
    if (isStructuredMessageEquivalent(renderedMessage, issues)) return issues
    return [...issues, toRootIssue(filePath, renderedMessage)]
  })
}

export async function validateApp(app: AppLinkedInterface, options: ValidateAppOptions = {json: false}): Promise<void> {
  const errors = app.errors

  if (!errors || errors.isEmpty()) {
    if (options.json) {
      outputResult(JSON.stringify({valid: true, issues: []}, null, 2))
      return
    }

    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const errorMessages = errors.toJSON().map((error) => stringifyMessage(error).trim())

  if (options.json) {
    outputResult(JSON.stringify({valid: false, issues: toPublicIssues(app)}, null, 2))
    throw new AbortSilentError()
  }

  renderError({
    headline: 'Validation errors found.',
    body: errorMessages.join('\n\n'),
  })

  throw new AbortSilentError()
}
