import {shouldDisplayColors} from '../../../../public/node/output.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface ScrollbarProps {
  containerHeight: number
  visibleListSectionLength: number
  fullListLength: number
  visibleFromIndex: number
  noColor?: boolean
}

const BACKGROUND_CHAR = '│'
const SCROLLBOX_CHAR = '║'

const Scrollbar: FunctionComponent<ScrollbarProps> = ({
  containerHeight,
  visibleListSectionLength,
  fullListLength,
  visibleFromIndex,
  noColor = !shouldDisplayColors(),
}) => {
  const displayArrows = containerHeight >= 4 && noColor
  const visibleToIndex = visibleFromIndex + visibleListSectionLength - 1

  // Leave 2 rows for top/bottom arrows when there is vertical room for them.
  const fullHeight = displayArrows ? containerHeight - 2 : containerHeight
  const scrollboxHeight = Math.min(
    fullHeight - 1,
    Math.ceil(Math.min(1, visibleListSectionLength / fullListLength) * fullHeight),
  )

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
        Math.round((visibleFromIndex / scrollableIncrements) * scrollingLength),
      ),
    )
  }
  const bottomBuffer = fullHeight - scrollboxHeight - topBuffer

  const backgroundChar = noColor ? BACKGROUND_CHAR : ' '
  const scrollboxChar = noColor ? SCROLLBOX_CHAR : ' '
  const bgColor = noColor ? undefined : 'gray'
  const scrollboxColor = noColor ? undefined : 'cyan'

  return (
    <Box flexDirection="column">
      {displayArrows ? <Text>△</Text> : null}

      <Box width={1}>
        <Text backgroundColor={bgColor}>{backgroundChar.repeat(topBuffer)}</Text>
      </Box>
      <Box width={1}>
        <Text backgroundColor={scrollboxColor}>{scrollboxChar.repeat(scrollboxHeight)}</Text>
      </Box>
      <Box width={1}>
        <Text backgroundColor={bgColor}>{backgroundChar.repeat(bottomBuffer)}</Text>
      </Box>

      {displayArrows ? <Text>▽</Text> : null}
    </Box>
  )
}

export {Scrollbar}
