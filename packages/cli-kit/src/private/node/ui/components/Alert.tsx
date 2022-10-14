import {Banner, BannerType} from './Banner.js'
import {Link} from './Link.js'
import {List, ListItem} from './List.js'
import {Box, Text} from 'ink'
import React from 'react'

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

const Alert: React.FC<AlertProps> = ({type, headline, body, nextSteps, reference, link, orderedNextSteps = false}) => {
  return (
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
    </Banner>
  )
}

export {Alert}
