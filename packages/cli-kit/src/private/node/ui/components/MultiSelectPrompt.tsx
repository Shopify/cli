import {MultiSelectInput, MultiSelectInputProps} from './MultiSelectInput.js'
import {Item as SelectItem} from './SelectInput.js'
import {InfoTableProps} from './Prompts/InfoTable.js'
import {InfoMessageProps} from './Prompts/InfoMessage.js'
import {Message, PromptLayout} from './Prompts/PromptLayout.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {useComplete} from '../../ui.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'

import React, {ReactElement, useCallback, useEffect} from 'react'

export interface MultiSelectPromptProps<T> {
  message: Message
  choices: MultiSelectInputProps<T>['items']
  onSubmit: (values: T[]) => void
  infoTable?: InfoTableProps['table']
  defaultValue?: T[]
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
  groupOrder?: string[]
}

function MultiSelectPrompt<T>({
  message,
  choices,
  infoTable,
  infoMessage,
  onSubmit,
  defaultValue,
  abortSignal,
  groupOrder,
}: React.PropsWithChildren<MultiSelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('MultiSelectPrompt requires at least one choice')
  }
  const complete = useComplete()
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<SelectItem<T>[]>({
    initialAnswer: [],
  })

  const submitAnswer = useCallback(
    (answer: SelectItem<T>[]) => {
      setAnswer(answer)
      setPromptState(PromptState.Submitted)
    },
    [setAnswer, setPromptState],
  )

  useEffect(() => {
    if (promptState === PromptState.Submitted) {
      onSubmit(answer.map((item) => item.value))
      complete()
    }
  }, [answer, onSubmit, promptState, complete])

  // Selecting zero items is valid, so fall back to a descriptive label rather
  // than leaving the submitted state blank.
  const submittedAnswerLabel = answer.length > 0 ? answer.map((item) => item.label).join(', ') : 'Nothing selected'

  return (
    <PromptLayout
      message={message}
      state={promptState}
      submittedAnswerLabel={submittedAnswerLabel}
      infoTable={infoTable}
      infoMessage={infoMessage}
      abortSignal={abortSignal}
      input={
        <MultiSelectInput defaultValue={defaultValue} items={choices} onSubmit={submitAnswer} groupOrder={groupOrder} />
      }
    />
  )
}

export {MultiSelectPrompt}
