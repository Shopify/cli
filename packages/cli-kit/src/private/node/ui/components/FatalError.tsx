import {Banner} from './Banner.js'
import {TokenizedText} from './TokenizedText.js'
import {Command} from './Command.js'
import {Bug, cleanSingleStackTracePath, ExternalError, Fatal} from '../../../../error.js'
import {Box, Text} from 'ink'
import React from 'react'
import StackTracey from 'stacktracey'

export interface FatalErrorProps {
  error: Fatal
}

const FatalError: React.FC<FatalErrorProps> = ({error}) => {
  let stack
  let tool

  if (error instanceof Bug) {
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
      {tool && (
        <Box marginBottom={1}>
          <Text>
            Error coming from <Command command={tool} />
          </Text>
        </Box>
      )}

      <Box>
        <Text>{error.message}</Text>
      </Box>

      {error.tryMessage && (
        <Box marginTop={1}>
          <TokenizedText item={error.tryMessage} />
        </Box>
      )}
      {stack && stack.items.length !== 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>To investigate the issue, examine this stack trace:</Text>
          {stack.items.map((item, index) => (
            <Box flexDirection="column" key={index}>
              <Text>
                at{item.calleeShort && <Text color="yellow">{` ${item.calleeShort}`}</Text>}
                {item.fileShort && ` (${item.fileShort}:${item.line})`}
              </Text>
              <Box paddingLeft={1}>
                <Text dimColor>{item.sourceLine?.trim()}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Banner>
  )
}

export {FatalError}
