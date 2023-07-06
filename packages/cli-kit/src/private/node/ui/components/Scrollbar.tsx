import {shouldDisplayColors} from '../../../../public/node/output.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

export interface ScrollbarProps {
  containerHeight: number
  visibleListSectionLength: number
  fullListLength: number
  visibleToIndex: number
  visibleFromIndex: number
  noColor?: boolean
}

const BACKGROUND_CHAR = '│'
const SCROLLBOX_CHAR = '║'

const Scrollbar: FunctionComponent<ScrollbarProps> = ({
  containerHeight,
  visibleListSectionLength,
  fullListLength,
  visibleToIndex,
  visibleFromIndex,
  noColor = !shouldDisplayColors(),
}) => {
    const displayArrows = containerHeight >= 4 && noColor

    // Leave 2 rows for top/bottom arrows when there is vertical room for them.
  const fullHeight = displayArrows ? containerHeight - 2 : containerHeight
  const scrollboxHeight = Math.min(fullHeight - 1, Math.ceil(Math.min(1, visibleListSectionLength / fullListLength) * fullHeight))

  let topBuffer: number
  // Ensure it scrolls all the way to the bottom when we hit the bottom
  if (visibleToIndex >= fullListLength - 1) {
    topBuffer = fullHeight - scrollboxHeight
  } else {
    // This is the actual number of rows available for the scrollbar to go up and down
    const scrollingLength = fullHeight - scrollboxHeight
    // This is the number of times the screen itself can scroll down
    const scrollableIncrements = fullListLength - visibleListSectionLength

    topBuffer = Math.max(
      // Never go negative, that causes errors!
      0,
      Math.min(
        // Never have more buffer than filling in all spaces above the scrollbox
        fullHeight - scrollboxHeight,
        Math.round((visibleFromIndex) / scrollableIncrements * scrollingLength)
      )
    )
  }
  const bottomBuffer = fullHeight - scrollboxHeight - topBuffer

  const backgroundChar = noColor ? BACKGROUND_CHAR : ' '
  const scrollboxChar = noColor ? SCROLLBOX_CHAR : ' '

  return (
    <Box width={1} height={containerHeight} flexDirection="column" flexGrow={0}>
      {
        displayArrows ? <Box width={1}><Text>△</Text></Box> : null
      }
      <Box width={1}><Text backgroundColor="gray">{backgroundChar.repeat(topBuffer)}</Text></Box>
      <Box width={1}><Text backgroundColor="cyan">{scrollboxChar.repeat(scrollboxHeight)}</Text></Box>
      <Box width={1}><Text backgroundColor="gray">{backgroundChar.repeat(bottomBuffer)}</Text></Box>
      {displayArrows ? <Box width={1}><Text>▽</Text></Box> : null}
    </Box>
  )
}

export {Scrollbar}
