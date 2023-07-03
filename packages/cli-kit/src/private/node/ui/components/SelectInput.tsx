import {debounce} from '../../../../public/common/function.js'
import {useSelectState} from '../hooks/use-select-state.js'
import {handleCtrlC} from '../../ui.js'
import React, {useRef, useCallback, forwardRef, useEffect} from 'react'
import {Box, Key, useInput, Text, DOMElement} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

declare module 'react' {
  function forwardRef<T, P>(
    render: (props: P, ref: React.Ref<T>) => JSX.Element | null,
  ): (props: P & React.RefAttributes<T>) => JSX.Element | null
}
export interface SelectInputProps<T> {
  items: Item<T>[]
  initialItems?: Item<T>[]
  onChange?: (item: Item<T> | undefined) => void
  enableShortcuts?: boolean
  focus?: boolean
  emptyMessage?: string
  defaultValue?: T
  highlightedTerm?: string
  loading?: boolean
  errorMessage?: string
  hasMorePages?: boolean
  morePagesMessage?: string
  infoMessage?: string
  availableLines?: number
  submitWithShortcuts?: boolean
  onSubmit?: (item: Item<T>) => void
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
  helperText?: string
  disabled?: boolean
}

export interface ItemWithKey<T> extends Item<T> {
  key: string
}

function highlightedLabel(label: string, term: string | undefined) {
  if (!term) {
    return label
  }

  const regex = new RegExp(term, 'i')
  return label.replace(regex, (match) => {
    return chalk.bold(match)
  })
}

interface ItemProps<T> {
  item: ItemWithKey<T>
  previousItem: ItemWithKey<T> | undefined
  items: ItemWithKey<T>[]
  isSelected: boolean
  highlightedTerm?: string
  enableShortcuts: boolean
  hasAnyGroup: boolean
  maxKeyLength: number
}

// eslint-disable-next-line react/function-component-definition
function Item<T>({
  item,
  previousItem,
  isSelected,
  highlightedTerm,
  enableShortcuts,
  items,
  hasAnyGroup,
  maxKeyLength,
}: ItemProps<T>): JSX.Element {
  const label = highlightedLabel(item.label, highlightedTerm)
  let title: string | undefined
  let labelColor

  if (isSelected) {
    labelColor = 'cyan'
  } else if (item.disabled) {
    labelColor = 'dim'
  }

  if (typeof previousItem === 'undefined' || item.group !== previousItem.group) {
    title = item.group ?? (hasAnyGroup ? 'Other' : undefined)
  }

  return (
    <Box
      key={item.key}
      flexDirection="column"
      marginTop={items.indexOf(item) !== 0 && title ? 1 : 0}
      minHeight={title ? 2 : 1}
    >
      {title ? (
        <Box marginLeft={3}>
          <Text bold>{title}</Text>
        </Box>
      ) : null}

      <Box key={item.key} marginLeft={hasAnyGroup ? 3 : 0}>
        <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        <Box marginLeft={enableShortcuts ? maxKeyLength - item.key.length : 0}>
          <Text color={labelColor}>{enableShortcuts ? `(${item.key}) ${label}` : label}</Text>
        </Box>
      </Box>
    </Box>
  )
}

const MAX_AVAILABLE_LINES = 25

// eslint-disable-next-line react/function-component-definition
function SelectInputInner<T>(
  {
    items: rawItems,
    initialItems = rawItems,
    onChange,
    enableShortcuts = true,
    focus = true,
    emptyMessage = 'No items to select.',
    defaultValue,
    highlightedTerm,
    loading = false,
    errorMessage,
    hasMorePages = false,
    morePagesMessage,
    infoMessage,
    availableLines = MAX_AVAILABLE_LINES,
    submitWithShortcuts = false,
    onSubmit,
  }: SelectInputProps<T>,
  ref: React.ForwardedRef<DOMElement>,
): JSX.Element | null {
  let noItems = false

  if (rawItems.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
    rawItems = [{label: emptyMessage, value: null as any, disabled: true}]
    noItems = true
  }

  const sortBy = require('lodash/sortBy')
  const hasAnyGroup = rawItems.some((item) => typeof item.group !== 'undefined')
  const items = sortBy(rawItems, 'group') as Item<T>[]
  const itemsWithKeys = items.map((item, index) => ({
    ...item,
    key: item.key ?? (index + 1).toString(),
  })) as ItemWithKey<T>[]

  function maximumLinesLostToGroups(items: Item<T>[]): number {
    // Calculate a safe estimate of the limit needed based on the space available
    const numberOfGroups = new Set(items.map((item) => item.group).filter((group) => group)).size
    // Add 1 to numberOfGroups because we also have a default Other group
    const maxVisibleGroups = Math.ceil(Math.min((availableLines + 1) / 3, numberOfGroups + 1))
    // If we have x visible groups, we lose 1 line to the first group + 2 lines to the rest
    return numberOfGroups > 0 ? (maxVisibleGroups - 1) * 2 + 1 : 0
  }

  const maxLinesLostToGroups = maximumLinesLostToGroups(items)
  const limit = Math.max(2, availableLines - maxLinesLostToGroups)
  const hasLimit = items.length > limit

  const inputStack = useRef<string | null>(null)

  const state = useSelectState({
    visibleOptionCount: limit,
    options: itemsWithKeys,
    defaultValue,
  })

  useEffect(() => {
    if (typeof state.value !== 'undefined' && state.previousValue !== state.value) {
      onChange?.(items.find((item) => item.value === state.value))
    }
  }, [state.previousValue, state.value, items, onChange])

  const handleArrows = (key: Key) => {
    if (key.upArrow) {
      state.selectPreviousOption()
    } else if (key.downArrow) {
      state.selectNextOption()
    }
  }

  const handleShortcuts = useCallback(
    (input: string) => {
      if (state.visibleOptions.map((item: Item<T>) => item.key).includes(input)) {
        const itemWithKey = state.visibleOptions.find((item: Item<T>) => item.key === input)
        const item = items.find((item) => item.value === itemWithKey?.value)

        if (itemWithKey && !itemWithKey.disabled) {
          // keep this order of operations so that there is no flickering
          if (submitWithShortcuts && onSubmit && item) {
            onSubmit(item)
          }

          state.selectOption({option: itemWithKey})
        }
      }
    },
    [items, onSubmit, state, submitWithShortcuts],
  )

  // disable exhaustive-deps because we want to memoize the debounce function itself
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceHandleShortcuts = useCallback(
    debounce((newInputStack) => {
      handleShortcuts(newInputStack)
      inputStack.current = null
    }, 300),
    [handleShortcuts],
  )

  useInput(
    (input, key) => {
      handleCtrlC(input, key)

      if (typeof state.value !== 'undefined' && key.return) {
        const item = items.find((item) => item.value === state.value)

        if (item && onSubmit) {
          onSubmit(item)
        }
      }

      // check that no special modifier (shift, control, etc.) is being pressed
      if (enableShortcuts && input.length > 0 && Object.values(key).every((value) => value === false)) {
        const newInputStack = inputStack.current === null ? input : inputStack.current + input

        inputStack.current = newInputStack
        debounceHandleShortcuts(newInputStack)
      } else {
        debounceHandleShortcuts.cancel()
        inputStack.current = null
        handleArrows(key)
      }
    },
    {isActive: focus},
  )

  if (loading) {
    return (
      <Box marginLeft={3}>
        <Text dimColor>Loading...</Text>
      </Box>
    )
  } else if (errorMessage && errorMessage.length > 0) {
    return (
      <Box marginLeft={3}>
        <Text color="red">{errorMessage}</Text>
      </Box>
    )
  } else {
    const optionsHeight = initialItems.length + maximumLinesLostToGroups(initialItems)
    const maxKeyLength = itemsWithKeys
      .map((item) => item.key?.length ?? 0)
      .reduce((lenA, lenB) => Math.max(lenA, lenB), 0)
    const minHeight = hasAnyGroup ? 5 : 2
    return (
      <Box flexDirection="column" ref={ref}>
        <Box
          flexDirection="column"
          height={Math.max(minHeight, Math.min(availableLines, optionsHeight))}
          overflowY="hidden"
        >
          {state.visibleOptions.map((item: ItemWithKey<T>, index: number) => (
            <Item
              key={item.key}
              item={item}
              previousItem={state.visibleOptions[index - 1]}
              highlightedTerm={highlightedTerm}
              isSelected={item.value === state.value}
              items={state.visibleOptions}
              enableShortcuts={enableShortcuts}
              hasAnyGroup={hasAnyGroup}
              maxKeyLength={maxKeyLength}
            />
          ))}
        </Box>

        {noItems ? (
          <Box marginTop={1} marginLeft={3} height={2}>
            <Text dimColor>Try again with a different keyword.</Text>
          </Box>
        ) : (
          <Box marginTop={1} marginLeft={3} flexDirection="column">
            <Text dimColor>
              {infoMessage
                ? infoMessage
                : `Press ${figures.arrowUp}${figures.arrowDown} arrows to select, enter to confirm.`}
            </Text>
            {hasMorePages ? (
              <Text>
                <Text bold>1-{items.length} of many</Text>
                {morePagesMessage ? `  ${morePagesMessage}` : null}
              </Text>
            ) : null}
            {hasLimit ? <Text dimColor>{`${items.length} options available, ${limit} visible.`}</Text> : null}
          </Box>
        )}
      </Box>
    )
  }
}

export const SelectInput = forwardRef(SelectInputInner)
