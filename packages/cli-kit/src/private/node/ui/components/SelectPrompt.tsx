import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTableProps} from './Prompts/InfoTable.js'
import {InfoMessageProps} from './Prompts/InfoMessage.js'
import {Message, PromptLayout} from './Prompts/PromptLayout.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'
import React, {ReactElement, useCallback, useEffect} from 'react'
import {useApp} from 'ink'

export interface SelectPromptProps<T> {
  message: Message
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  defaultValue?: T
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
}

// eslint-disable-next-line react/function-component-definition
function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  infoMessage,
  onSubmit,
  defaultValue,
  abortSignal,
}: React.PropsWithChildren<SelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('SelectPrompt requires at least one choice')
  }
  const {exit: unmountInk} = useApp()
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<SelectItem<T> | undefined>({
    initialAnswer: undefined,
  })

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      setAnswer(answer)
      setPromptState(PromptState.Submitted)
    },
    [setAnswer, setPromptState],
  )

  useEffect(() => {
    if (promptState === PromptState.Submitted && answer) {
      unmountInk()
      onSubmit(answer.value)
    }
  }, [answer, onSubmit, promptState, unmountInk])

  return (
    <PromptLayout
      message={message}
      state={promptState}
      submittedAnswerLabel={answer?.label}
      infoTable={infoTable}
      infoMessage={infoMessage}
      abortSignal={abortSignal}
      input={<SelectInput defaultValue={defaultValue} items={choices} onSubmit={submitAnswer} />}
    />
  )
}

export {SelectPrompt}
