import {appFlags} from '../../../flags.js'
import {validateApp} from '../../../services/validate.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult, unstyled} from '@shopify/cli-kit/node/output'

import type {AppValidationIssue} from '../../../models/app/error-parsing.js'

function toRootIssue(filePath: string, message: string): AppValidationIssue {
  return {
    filePath,
    path: [],
    pathString: 'root',
    message,
  }
}

function hasMeaningfulPrefix(prefix: string): boolean {
  const normalizedPrefix = prefix.trim()
  return normalizedPrefix !== '' && normalizedPrefix !== 'App configuration is not valid'
}

function isJsonValidationAbort(error: AbortError): boolean {
  const message = unstyled(error.message).trim()

  return (
    message.includes('Validation errors in ') ||
    message.startsWith("Couldn't find an app toml file at") ||
    message.startsWith("Couldn't find directory ") ||
    /^Couldn't find .* in .+\.?$/.test(message)
  )
}

function toJsonIssuesFromAbortError(error: AbortError, fallbackFilePath: string): AppValidationIssue[] {
  const message = unstyled(error.message).trim()
  const marker = 'Validation errors in '
  const markerIndex = message.indexOf(marker)

  if (markerIndex === -1) {
    return [toRootIssue(fallbackFilePath, message)]
  }

  const bodyStartIndex = message.indexOf('\n\n', markerIndex)
  if (bodyStartIndex === -1) {
    return [toRootIssue(fallbackFilePath, message)]
  }

  const filePathLine = message.slice(markerIndex + marker.length, bodyStartIndex)
  if (!filePathLine.endsWith(':')) {
    return [toRootIssue(fallbackFilePath, message)]
  }

  const filePath = filePathLine.slice(0, -1)
  const body = message.slice(bodyStartIndex + 2)
  const issues = Array.from(body.matchAll(/^• \[([^\]]+)\]: (.+)$/gm)).map((captures) => {
    const pathString = captures[1]!
    const issueMessage = captures[2]!

    return {
      filePath,
      // `pathString` is rendered display text, not a lossless encoding of the
      // original structured path, so the early-abort fallback avoids
      // reconstructing `path` from it.
      path: [],
      pathString,
      message: issueMessage,
    }
  })

  if (issues.length === 0) return [toRootIssue(filePath, message)]
  if (hasMeaningfulPrefix(message.slice(0, markerIndex))) return [...issues, toRootIssue(filePath, message)]
  return issues
}

export default class Validate extends AppLinkedCommand {
  static summary = 'Validate your app configuration and extensions.'

  static descriptionWithMarkdown = `Validates the selected app configuration file and all extension configurations against their schemas and reports any errors found.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Validate)

    try {
      const {app} = await linkedAppContext({
        directory: flags.path,
        clientId: flags['client-id'],
        forceRelink: flags.reset,
        userProvidedConfigName: flags.config,
        unsafeTolerateErrors: true,
      })

      await validateApp(app, {json: flags.json})

      return {app}
    } catch (error) {
      if (flags.json && error instanceof AbortError && isJsonValidationAbort(error)) {
        outputResult(
          JSON.stringify(
            {
              valid: false,
              issues: toJsonIssuesFromAbortError(error, flags.path),
            },
            null,
            2,
          ),
        )
        throw new AbortSilentError()
      }

      throw error
    }
  }
}
