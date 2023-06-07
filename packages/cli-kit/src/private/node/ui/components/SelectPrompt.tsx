import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {InlineToken, LinkToken, TokenItem, TokenizedText, UserInputToken} from './TokenizedText.js'
import {messageWithPunctuation} from '../utilities.js'
import {uniqBy} from '../../../../public/common/array.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import React, {ReactElement, useCallback, useLayoutEffect, useState} from 'react'
import {Box, measureElement, Text, useApp, useStdout, TextProps} from 'ink'
import figures from 'figures'
import ansiEscapes from 'ansi-escapes'

export interface InfoMessage {
  title: {
    color?: TextProps['color']
    text: TokenItem<Exclude<InlineToken, UserInputToken | LinkToken>>
  }
  body: TokenItem
}

export interface SelectPromptProps<T> {
  message: TokenItem<Exclude<InlineToken, LinkToken>>
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  defaultValue?: T
  submitWithShortcuts?: boolean
  abortSignal?: AbortSignal
  infoMessage?: InfoMessage
}

// eslint-disable-next-line react/function-component-definition
function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  infoMessage,
  onSubmit,
  defaultValue,
  submitWithShortcuts = false,
  abortSignal,
}: React.PropsWithChildren<SelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('SelectPrompt requires at least one choice')
  }
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(undefined)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const {stdout} = useStdout()
  const [wrapperHeight, setWrapperHeight] = useState(0)
  const [selectInputHeight, setSelectInputHeight] = useState(0)
  const [limit, setLimit] = useState(choices.length)
  const numberOfGroups = uniqBy(
    choices.filter((choice) => choice.group),
    'group',
  ).length

  const wrapperRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setWrapperHeight(height)
    }
  }, [])

  const inputRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setSelectInputHeight(height)
    }
  }, [])

  useLayoutEffect(() => {
    function onResize() {
      const availableSpace = stdout.rows - (wrapperHeight - selectInputHeight)
      // rough estimate of the limit needed based on the space available
      const newLimit = Math.max(2, availableSpace - numberOfGroups * 2 - 4)

      if (newLimit < limit) {
        stdout.write(ansiEscapes.clearTerminal)
      }

      setLimit(Math.min(newLimit, choices.length))
    }

    onResize()

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [wrapperHeight, selectInputHeight, choices.length, numberOfGroups, stdout, limit])

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      if (stdout && wrapperHeight >= stdout.rows) {
        stdout.write(ansiEscapes.clearTerminal)
      }
      setAnswer(answer)
      setSubmitted(true)
      unmountInk()
      onSubmit(answer.value)
    },
    [stdout, wrapperHeight, unmountInk, onSubmit],
  )

  const {isAborted} = useAbortSignal(abortSignal)

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} ref={wrapperRef}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {(infoTable || infoMessage) && !submitted ? (
        <Box marginLeft={7} marginTop={1} flexDirection="column" gap={1}>
          {infoMessage ? (
            <Box flexDirection="column" gap={1}>
              <Text color={infoMessage.title.color}>
                <TokenizedText item={infoMessage.title.text} />
              </Text>
              <TokenizedText item={infoMessage.body} />
            </Box>
          ) : null}
          {infoTable ? <InfoTable table={infoTable} /> : null}
        </Box>
      ) : null}
      {submitted ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer!.label}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <SelectInput
            defaultValue={defaultValue}
            items={choices}
            infoMessage={
              submitWithShortcuts
                ? `Press ${figures.arrowUp}${figures.arrowDown} arrows to select, enter or a shortcut to confirm`
                : undefined
            }
            limit={limit}
            ref={inputRef}
            submitWithShortcuts={submitWithShortcuts}
            onSubmit={submitAnswer}
          />
        </Box>
      )}
    </Box>
  )
}

export {SelectPrompt}
