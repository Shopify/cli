import {InlineToken, TokenizedText, tokenItemToString} from './TokenizedText.js'
import {unstyled} from '../../../../public/node/output.js'
import {Box} from 'ink'
import React, {FunctionComponent} from 'react'

export interface TabularDataProps {
  tabularData: InlineToken[][]
  firstColumnSubdued?: boolean
}

const TabularData: FunctionComponent<TabularDataProps> = ({tabularData: data, firstColumnSubdued}) => {
  const columnWidths: number[] = data.reduce<number[]>((acc, row) => {
    row.forEach((cell, index) => {
      acc[index] = Math.max(acc[index] ?? 0, unstyled(tokenItemToString(cell)).length)
    })
    return acc
  }, [])

  return (
    <Box flexDirection="column">
      {data.map((row, index) => (
        <Box key={index} flexDirection="row" gap={2}>
          {row.map((cell, index) => (
            <Box key={index} width={columnWidths[index] ?? 0} flexShrink={index === 0 ? 0 : 1}>
              <TokenizedText
                item={index === 0 && firstColumnSubdued && typeof cell === 'string' ? {subdued: cell} : cell}
              />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export {TabularData}
