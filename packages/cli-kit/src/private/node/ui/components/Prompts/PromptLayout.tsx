import {GitDiff, GitDiffProps} from './GitDiff.js'
import {InfoMessage, InfoMessageProps} from './InfoMessage.js'
import {InfoTable, InfoTableProps} from './InfoTable.js'
import {InlineToken, LinkToken, TokenItem, TokenizedText} from '../TokenizedText.js'
import {messageWithPunctuation} from '../../utilities.js'
import {AbortSignal} from '../../../../../public/node/abort.js'
import useAbortSignal from '../../hooks/use-abort-signal.js'
import React, {ReactElement, cloneElement, useCallback, useLayoutEffect, useState} from 'react'
import {Box, measureElement, Text, useStdout} from 'ink'
import figures from 'figures'

export type Message = TokenItem<Exclude<InlineToken, LinkToken>>

export interface PromptLayoutProps {
  message: Message
  infoTable?: InfoTableProps['table']
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
  gitDiff?: GitDiffProps['gitDiff']
  header?: ReactElement | null
  submitted: boolean
  submittedAnswerLabel?: string
  input: ReactElement
}

const SELECT_INPUT_FOOTER_HEIGHT = 4

const PromptLayout = ({
  message,
  infoTable,
  abortSignal,
  infoMessage,
  gitDiff,
  header,
  submitted,
  input,
  submittedAnswerLabel,
}: PromptLayoutProps): ReactElement | null => {
  const {stdout} = useStdout()
  const [wrapperHeight, setWrapperHeight] = useState(0)
  const [promptAreaHeight, setPromptAreaHeight] = useState(0)
  const currentAvailableLines = stdout.rows - promptAreaHeight - SELECT_INPUT_FOOTER_HEIGHT
  const [availableLines, setAvailableLines] = useState(currentAvailableLines)
  const inputComponent = cloneElement(input, {availableLines})

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

  useLayoutEffect(() => {
    function onResize() {
      const newAvailableLines = stdout.rows - promptAreaHeight - SELECT_INPUT_FOOTER_HEIGHT
      if (newAvailableLines !== availableLines) {
        setAvailableLines(newAvailableLines)
      }
    }

    onResize()

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [wrapperHeight, promptAreaHeight, stdout, availableLines])

  const {isAborted} = useAbortSignal(abortSignal)

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

        {(infoTable || infoMessage || gitDiff) && !submitted ? (
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
            {infoTable ? <InfoTable table={infoTable} /> : null}
            {gitDiff ? <GitDiff gitDiff={gitDiff} /> : null}
          </Box>
        ) : null}
      </Box>

      {submitted && submittedAnswerLabel ? (
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
