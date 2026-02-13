import {Banner, BannerType} from './Banner.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {BoldToken, InlineToken, LinkToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {TabularData, TabularDataProps} from './TabularData.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

export interface CustomSection {
  title?: string
  body: TabularDataProps | TokenItem
}

export interface AlertProps {
  type: Exclude<BannerType, 'external_error'>
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

const Alert: FunctionComponent<AlertProps> = ({
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
      {headline ? (
        <Text bold>
          <TokenizedText item={headline} />
        </Text>
      ) : null}

      {body ? <TokenizedText item={body} /> : null}

      {nextSteps && nextSteps.length > 0 ? (
        <List title="Next steps" items={nextSteps} ordered={orderedNextSteps} />
      ) : null}

      {reference && reference.length > 0 ? <List title="Reference" items={reference} /> : null}

      {link ? <Link url={link.url} label={link.label} /> : null}

      {customSections && customSections.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          {customSections.map((section, index) => (
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
    </Banner>
  )
}

export {Alert}
