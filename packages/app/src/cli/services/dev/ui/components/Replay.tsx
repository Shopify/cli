import {Box, Text, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'

import figures from '@shopify/cli-kit/node/figures'


export interface ReplayProps {
  selectedRun: string
  abortController: AbortController
}

const Replay: FunctionComponent<ReplayProps> = ({
  selectedRun,
  abortController
}) => {
  const now = new Date()
  const season = now.getMonth() > 3 ? 'Summer' : 'Winter'
  const year = now.getFullYear()

  return (
    <>
      {/* <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={calculatePrefixColumnSize(errorHandledProcesses, app.extensions)}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
      /> */}
      {/* eslint-disable-next-line no-negated-condition */}
      {/* {!isAborted ? ( */}
        <Box
          marginY={1}
          paddingTop={1}
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderTop
        >
          {/* {canUseShortcuts ? ( */}
            <Box flexDirection="column">
              <Text>
                {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
              </Text>
              <Text>
                {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
              </Text>
            </Box>
          {/* ) : null} */}
          {/* <Box marginTop={canUseShortcuts ? 1 : 0}> */}
            {/* <Text>{statusMessage}</Text> */}
          {/* </Box> */}
          {/* {error ? <Text color="red">{error}</Text> : null} */}
        </Box>
      {/* ) : null} */}
    </>
  )
}
