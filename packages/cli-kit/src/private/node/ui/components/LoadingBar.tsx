import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import {shouldDisplayColors} from '../../../../public/node/output.js'
import {isTTY} from '../../../../public/node/ui.js'
import {isCloudEnvironment} from '../../../../public/node/context/local.js'
import React from 'react'
import {Box, Text} from 'ink'

const loadingBarChar = '▀'
const hillString = '▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁'

interface LoadingBarProps {
  title: string
  noColor?: boolean
}

const LoadingBar = ({title, noColor}: React.PropsWithChildren<LoadingBarProps>) => {
  const {twoThirds} = useLayout()
  let loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  if (noColor ?? !shouldDisplayColors()) {
    loadingBar = hillString.repeat(Math.ceil(twoThirds / hillString.length))
  }

  const disableAnimation = isCloudEnvironment() || !isTTY()

  return (
    <Box flexDirection="column">
      <TextAnimation text={loadingBar} maxWidth={twoThirds} isStatic={disableAnimation} />
      <Text>{title} ...</Text>
    </Box>
  )
}

export {LoadingBar}
