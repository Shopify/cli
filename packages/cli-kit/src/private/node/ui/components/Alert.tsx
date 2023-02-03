import {Banner, BannerType} from './Banner.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {BoldToken, InlineToken, LinkToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface CustomSection {
  title?: string
  body: TokenItem
}

export interface AlertProps {
  type: Exclude<BannerType, 'error' | 'external_error'>
  headline?: TokenItem<Exclude<InlineToken, LinkToken | BoldToken>>
  body?: TokenItem
  nextSteps?: TokenItem<InlineToken>[]
  reference?: TokenItem<InlineToken>[]
  link?: {
    label: string
    url: string
  }
  orderedNextSteps?: boolean
  customSections?: CustomSection[]
}

const Alert: React.FC<AlertProps> = ({
  type,
  headline,
  body,
  nextSteps,
  reference,
  link,
  customSections,
  orderedNextSteps = false,
}) => {
  return (
    <Banner type={type}>
      {headline && (
        <Box>
          <Text bold>
            <TokenizedText item={headline} />
          </Text>
        </Box>
      )}

      {body && (
        <Box marginTop={headline ? 1 : 0}>
          <TokenizedText item={body} />
        </Box>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <Box marginTop={1}>
          <List title="Next steps" items={nextSteps} ordered={orderedNextSteps} />
        </Box>
      )}

      {reference && reference.length > 0 && (
        <Box marginTop={1}>
          <List title="Reference" items={reference} />
        </Box>
      )}

      {link && (
        <Box marginTop={1}>
          <Link url={link.url} label={link.label} />
        </Box>
      )}

      {customSections && customSections.length > 0 && (
        <Box flexDirection="column">
          {customSections.map((section, index) => (
            <Box key={index} flexDirection="column" marginTop={1}>
              {section.title && <Text bold>{section.title}</Text>}
              <TokenizedText item={section.body} />
            </Box>
          ))}
        </Box>
      )}
    </Banner>
  )
}

export {Alert}
