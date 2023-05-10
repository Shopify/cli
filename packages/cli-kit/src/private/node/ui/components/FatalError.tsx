import {Banner} from './Banner.js'
import {TokenizedText} from './TokenizedText.js'
import {Command} from './Command.js'
import {List} from './List.js'
import {BugError, cleanSingleStackTracePath, ExternalError, FatalError as Fatal} from '../../../../public/node/error.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'
import StackTracey from 'stacktracey'

export interface FatalErrorProps {
  error: Fatal
}

const FatalError: FunctionComponent<FatalErrorProps> = ({error}) => {
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
        <Box marginBottom={1}>
          <Text>
            Error coming from <Command command={tool} />
          </Text>
        </Box>
      ) : null}

      <Box>
        {error.formattedMessage ? <TokenizedText item={error.formattedMessage} /> : <Text>{error.message}</Text>}
      </Box>

      {error.tryMessage ? (
        <Box marginTop={1}>
          <TokenizedText item={error.tryMessage} />
        </Box>
      ) : null}

      {error.nextSteps && error.nextSteps.length > 0 ? (
        <Box marginTop={1}>
          <List title="Next steps" items={error.nextSteps} />
        </Box>
      ) : null}

      {error.customSections && error.customSections.length > 0 ? (
        <Box flexDirection="column">
          {error.customSections.map((section, index) => (
            <Box key={index} flexDirection="column" marginTop={1}>
              {section.title ? <Text bold>{section.title}</Text> : null}
              <TokenizedText item={section.body} />
            </Box>
          ))}
        </Box>
      ) : null}

      {stack && stack.items.length !== 0 ? (
        <Box marginTop={1} flexDirection="column">
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

export {FatalError}
