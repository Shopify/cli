import {Banner, BannerType} from './Banner.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {TextTokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface AlertProps {
  type: Exclude<BannerType, 'error' | 'external_error'>
  headline: string
  body?: TextTokenItem
  nextSteps?: TextTokenItem[]
  reference?: TextTokenItem[]
  link?: {
    label: string
    url: string
  }
  orderedNextSteps?: boolean
}

const Alert: React.FC<AlertProps> = ({type, headline, body, nextSteps, reference, link, orderedNextSteps = false}) => {
  return (
    <Banner type={type}>
      <Box>
        <Text>{headline}</Text>
      </Box>

      {body && (
        <Box marginTop={1}>
          <TokenizedText item={body} />
        </Box>
      )}

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
