import {shouldDisplayColors} from '../../../../public/node/output.js'
import React, {useLayoutEffect, useState} from 'react'
import {Text} from 'ink'

const SHOPIFY_GREEN = '#96BF48'
const CHEVRON_BLINK_INTERVAL_MS = 350

interface LoadingIndicatorProps {
  title: string
  noColor?: boolean
}

const LoadingIndicator = ({title, noColor = !shouldDisplayColors()}: LoadingIndicatorProps) => {
  const [isChevronVisible, setIsChevronVisible] = useState(true)

  useLayoutEffect(() => {
    const interval = setInterval(() => {
      setIsChevronVisible((isVisible) => !isVisible)
    }, CHEVRON_BLINK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <Text>
      <Text bold italic>
        S
      </Text>
      <Text bold color={noColor ? undefined : SHOPIFY_GREEN}>
        {isChevronVisible ? '>' : ' '}
      </Text>
      {` ${title}...`}
    </Text>
  )
}

export {LoadingIndicator}
