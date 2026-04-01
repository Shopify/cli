import {Banner} from './Banner.js'
import {TokenizedText} from './TokenizedText.js'
import {Command} from './Command.js'
import {List} from './List.js'
import {TabularData} from './TabularData.js'
import {
  BugError,
  cleanSingleStackTracePath,
  ExternalError,
  FatalError as Fatal,
  type DomainError,
} from '../../../../public/node/error.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'
import StackTracey from 'stacktracey'

function isDomainError(error: unknown): error is Fatal & DomainError {
  return error instanceof Fatal && 'code' in error && 'details' in error
}

interface FatalErrorProps {
  error: Fatal
}

const FatalError: FunctionComponent<FatalErrorProps> = ({error}) => {
  if (isDomainError(error)) {
    return <DomainErrorBanner error={error} />
  }

  let stack
  let tool

  if (error instanceof BugError) {
    stack = new StackTracey(error)
    stack.items.forEach((item) => {
      item.file = cleanSingleStackTracePath(item.file)
    })

    stack = stack.withSources()
    stack = stack
      .filter((entry) => {
        return !entry.file.includes('@oclif/core')
      })
      .map((item) => {
        /** We make the paths relative to the packages/ directory */
        const fileShortComponents = item.fileShort.split('packages/')

        item.fileShort = fileShortComponents.length === 2 ? fileShortComponents[1]! : fileShortComponents[0]!
        return item
      })
  }

  if (error instanceof ExternalError) {
    tool = `${error.command} ${error.args.join(' ')}`
  }

  return (
    <Banner type={tool ? 'external_error' : 'error'}>
      {tool ? (
        <Text>
          Error coming from <Command command={tool} />
        </Text>
      ) : null}

      {error.formattedMessage ? <TokenizedText item={error.formattedMessage} /> : <Text>{error.message}</Text>}

      {error.tryMessage ? <TokenizedText item={error.tryMessage} /> : null}

      {error.nextSteps && error.nextSteps.length > 0 ? <List title="Next steps" items={error.nextSteps} /> : null}

      {error.customSections && error.customSections.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          {error.customSections.map((section, index) => (
            <Box key={index} flexDirection="column">
              {section.title ? <Text bold>{section.title}</Text> : null}
              {typeof section.body === 'object' && 'tabularData' in section.body ? (
                <TabularData {...section.body} />
              ) : (
                <TokenizedText item={section.body} />
              )}
            </Box>
          ))}
        </Box>
      ) : null}

      {stack && stack.items.length !== 0 ? (
        <Box flexDirection="column">
          <Text>To investigate the issue, examine this stack trace:</Text>
          {stack.items.map((item, index) => (
            <Box flexDirection="column" key={index} paddingLeft={2}>
              <Text>
                at{item.calleeShort ? <Text color="yellow">{` ${item.calleeShort}`}</Text> : null}
                {item.fileShort ? ` (${item.fileShort}:${item.line})` : null}
              </Text>
              <Box paddingLeft={2}>
                <Text dimColor>{item.sourceLine?.trim()}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}
    </Banner>
  )
}

const DomainErrorBanner: FunctionComponent<{error: Fatal & DomainError}> = ({error}) => {
  const {details} = error

  switch (error.code) {
    case 'no-project-root':
      return (
        <Banner type="error">
          <Text>
            Could not find a Shopify app configuration file. Looked in {String(details.directory)} and parent
            directories.
          </Text>
        </Banner>
      )
    case 'no-app-configs':
      return (
        <Banner type="error">
          <Text>Could not find a Shopify app TOML file in {String(details.directory)}</Text>
        </Banner>
      )
    case 'config-not-found':
      return (
        <Banner type="error">
          <Text>
            Couldn&apos;t find {String(details.configName)} in {String(details.directory)}.
          </Text>
        </Banner>
      )
    case 'toml-not-found':
    case 'toml-parse-error':
      return (
        <Banner type="error">
          <Box flexDirection="column">
            <Text bold>TOML error in {String(details.path)}:</Text>
            <Text>{String(details.message)}</Text>
          </Box>
        </Banner>
      )
    case 'schema-validation': {
      const errors = (details.errors ?? []) as {file?: string; path?: (string | number)[]; message: string}[]
      return (
        <Banner type="error">
          <Box flexDirection="column">
            <Text bold>Validation errors in {String(details.configPath)}:</Text>
            {errors.map((ce, idx) => (
              <Text key={idx}> • {ce.path?.length ? `[${ce.path.join('.')}]: ${ce.message}` : ce.message}</Text>
            ))}
          </Box>
        </Banner>
      )
    }
    default:
      return (
        <Banner type="error">
          <Text>{error.message}</Text>
        </Banner>
      )
  }
}

export {FatalError}
