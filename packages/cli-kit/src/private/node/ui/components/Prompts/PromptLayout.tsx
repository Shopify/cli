import {InfoMessage, InfoMessageProps} from './InfoMessage.js'
import {InfoTable, InfoTableProps} from './InfoTable.js'
import {InlineToken, LinkToken, TokenItem, TokenizedText} from '../TokenizedText.js'
import {messageWithPunctuation} from '../../utilities.js'
import {AbortSignal} from '../../../../../public/node/abort.js'
import useAbortSignal from '../../hooks/use-abort-signal.js'
import {PromptState} from '../../hooks/use-prompt.js'
import React, {ReactElement, cloneElement, useCallback, useLayoutEffect, useState} from 'react'
import {Box, measureElement, Text, useStdout} from 'ink'
import figures from 'figures'

export type Message = TokenItem<Exclude<InlineToken, LinkToken>>

export interface PromptLayoutProps {
  message: Message
  infoTable?: InfoTableProps['table']
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
  header?: ReactElement | null
  state: PromptState
  submittedAnswerLabel?: string
  input: ReactElement
}

const PromptLayout = ({
  message,
  infoTable,
  abortSignal,
  infoMessage,
  header,
  state,
  input,
  submittedAnswerLabel,
}: PromptLayoutProps): ReactElement | null => {
  const {stdout} = useStdout()
  const [wrapperHeight, setWrapperHeight] = useState(0)
  const [promptAreaHeight, setPromptAreaHeight] = useState(0)
  const [inputFixedAreaHeight, setInputFixedAreaHeight] = useState(0)
  const currentAvailableLines = stdout.rows - promptAreaHeight - inputFixedAreaHeight
  const [availableLines, setAvailableLines] = useState(currentAvailableLines)

  const wrapperRef = useCallback(
    (node) => {
      if (node !== null) {
        const {height} = measureElement(node)
        if (wrapperHeight !== height) {
          setWrapperHeight(height)
        }
      }
    },
    [wrapperHeight],
  )

  const promptAreaRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setPromptAreaHeight(height)
    }
  }, [])

  const inputFixedAreaRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      // + 3 accounts for the margins inside the input elements and the last empty line of the terminal
      setInputFixedAreaHeight(height + 3)
    }
  }, [])

  const inputComponent = cloneElement(input, {availableLines, inputFixedAreaRef})

  useLayoutEffect(() => {
    function onResize() {
      const newAvailableLines = stdout.rows - promptAreaHeight - inputFixedAreaHeight
      if (newAvailableLines !== availableLines) {
        setAvailableLines(newAvailableLines)
      }
    }

    onResize()

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [wrapperHeight, promptAreaHeight, stdout, availableLines, inputFixedAreaHeight])

  const {isAborted} = useAbortSignal(abortSignal)
  // Object.keys on an array returns the indices as strings
  const showInfoTable = infoTable && Object.keys(infoTable).length > 0

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} ref={wrapperRef}>
      <Box ref={promptAreaRef} flexDirection="column">
        <Box>
          <Box marginRight={2}>
            <Text>?</Text>
          </Box>
          <TokenizedText item={messageWithPunctuation(message)} />
          {header}
        </Box>

        {(showInfoTable || infoMessage) && state !== PromptState.Submitted ? (
          <Box
            marginTop={1}
            marginLeft={3}
            paddingLeft={2}
            borderStyle="bold"
            borderLeft
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            flexDirection="column"
            gap={1}
          >
            {infoMessage ? <InfoMessage message={infoMessage} /> : null}
            {showInfoTable ? <InfoTable table={infoTable} /> : null}
          </Box>
        ) : null}
      </Box>

      {state === PromptState.Submitted && submittedAnswerLabel ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{submittedAnswerLabel}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>{inputComponent}</Box>
      )}
    </Box>
  )
}

export {PromptLayout}
