import {Banner, BannerType} from './components/Banner.js'
import {Link} from './components/Link.js'
import {List, ListItem} from './components/List.js'
import {renderOnce} from '../ui.js'
import {consoleLog, consoleWarn, Logger, LogLevel} from '../../../output.js'
import React from 'react'
import {Box, Text} from 'ink'

export interface AlertProps {
  type: Exclude<BannerType, 'error'>
  headline?: string
  body: string
  nextSteps?: ListItem[]
  reference?: ListItem[]
  link?: {
    label: string
    url: string
  }
  orderedNextSteps?: boolean
}

const typeToLogLevel: {[key in AlertProps['type']]: LogLevel} = {
  info: 'info',
  warning: 'warn',
  success: 'info',
}

const typeToLogger: {[key in AlertProps['type']]: Logger} = {
  info: consoleLog,
  warning: consoleWarn,
  success: consoleLog,
}

export function alert({type, headline, body, nextSteps, reference, link, orderedNextSteps = false}: AlertProps) {
  renderOnce(
    <Banner type={type}>
      {headline && (
        <Box marginBottom={1}>
          <Text>{headline}</Text>
        </Box>
      )}

      <Box>
        <Text dimColor>{body}</Text>
      </Box>

      {nextSteps && (
        <Box marginTop={1}>
          <List title="Next steps" items={nextSteps} ordered={orderedNextSteps} />
        </Box>
      )}

      {reference && (
        <Box marginTop={1}>
          <List title="Reference" items={reference} />
        </Box>
      )}

      {link && (
        <Box marginTop={1}>
          <Link url={link.url} label={link.label} />
        </Box>
      )}
    </Banner>,
    typeToLogLevel[type],
    typeToLogger[type],
  )
}
