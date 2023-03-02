import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {InlineToken, LinkToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import {messageWithPunctuation} from '../utilities.js'
import React, {ReactElement, useCallback, useState} from 'react'
import {Box, measureElement, Text, useApp, useInput, useStdout} from 'ink'
import figures from 'figures'
import ansiEscapes from 'ansi-escapes'

export interface SelectPromptProps<T> {
  message: TokenItem<Exclude<InlineToken, LinkToken>>
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  defaultValue?: T
  submitWithShortcuts?: boolean
}

// eslint-disable-next-line react/function-component-definition
function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  onSubmit,
  defaultValue,
  submitWithShortcuts = false,
}: React.PropsWithChildren<SelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('SelectPrompt requires at least one choice')
  }
  const initialValue = defaultValue ? choices.find((choice) => choice.value === defaultValue) ?? choices[0] : choices[0]
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(initialValue)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const {stdout} = useStdout()
  const [height, setHeight] = useState(0)

  const measuredRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setHeight(height)
    }
  }, [])

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      if (stdout && height >= stdout.rows) {
        stdout.write(ansiEscapes.clearTerminal)
      }
      setSubmitted(true)
      unmountInk()
      onSubmit(answer.value)
    },
    [stdout, height, unmountInk, onSubmit],
  )

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return && answer) {
          submitAnswer(answer)
        }
      },
      [answer, submitAnswer],
    ),
  )

  return (
    <Box flexDirection="column" marginBottom={1} ref={measuredRef}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {infoTable && !submitted ? (
        <Box marginLeft={7} marginTop={1}>
          <InfoTable table={infoTable} />
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
            defaultValue={initialValue}
            items={choices}
            infoMessage={
              submitWithShortcuts
                ? `Press ${figures.arrowUp}${figures.arrowDown} arrows to select, enter or a shortcut to confirm`
                : undefined
            }
            onChange={({item, usedShortcut}) => {
              setAnswer(item)

              if (submitWithShortcuts && usedShortcut && item) {
                submitAnswer(item)
              }
            }}
          />
        </Box>
      )}
    </Box>
  )
}

export {SelectPrompt}
