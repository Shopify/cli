import {TokenItem, TokenizedText} from './components/TokenizedText.js'
import {renderOnce} from '../ui.js'
import {Logger, LogLevel} from '../../../public/node/output.js'
import React from 'react'
import {Box, Text, Newline} from 'ink'

export interface RenderGenericTextOptions {
  logLevel: LogLevel
  logger: Logger
  preface: string
  prefaceColor?: string
}

export function renderGenericText(
  tokenItem: TokenItem,
  {logLevel, logger, preface, prefaceColor}: RenderGenericTextOptions,
): string {
  return renderOnce(
    <Box flexDirection="row">
      <Box width={3}>
        <Text color={prefaceColor}>{preface}</Text>
      </Box>
      <Box>
        <TokenizedText item={tokenItem} />
        <Newline />
      </Box>
    </Box>,
    {logLevel, logger},
  )
}
