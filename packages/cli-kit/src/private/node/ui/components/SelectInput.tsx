import {Scrollbar} from './Scrollbar.js'
import {useSelectState} from '../hooks/use-select-state.js'
import useLayout from '../hooks/use-layout.js'
import {handleCtrlC} from '../../ui.js'
import React, {useCallback, forwardRef, useEffect} from 'react'
import {Box, Key, useInput, Text, DOMElement} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import sortBy from 'lodash/sortBy.js'

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
  availableLines?: number
  onSubmit?: (item: Item<T>) => void
  inputFixedAreaRef?: React.RefObject<DOMElement>
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
  helperText?: string
  disabled?: boolean
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

function validateKeys(items: Item<unknown>[]) {
  if (items.some((item) => (item.key?.length ?? 0) > 1)) {
    throw new Error('SelectInput: Keys must be a single character')
  }

  if (!items.every((item) => typeof item.key !== 'undefined' && item.key.length > 0)) {
    throw new Error('SelectInput: All items must have keys if one does')
  }
}

interface ItemProps<T> {
  item: Item<T>
  previousItem: Item<T> | undefined
  items: Item<T>[]
  isSelected: boolean
  highlightedTerm?: string
  enableShortcuts: boolean
  hasAnyGroup: boolean
  index: number
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
  index,
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

  const showKey = enableShortcuts && item.key && item.key.length > 0

  return (
    <Box
      key={index}
      flexDirection="column"
      marginTop={items.indexOf(item) !== 0 && title ? 1 : 0}
      minHeight={title ? 2 : 1}
    >
      {title ? (
        <Box marginLeft={3}>
          <Text bold>{title}</Text>
        </Box>
      ) : null}

      <Box key={index} marginLeft={hasAnyGroup ? 3 : 0}>
        <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        <Text color={labelColor}>{showKey ? `(${item.key}) ${label}` : label}</Text>
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
    availableLines = MAX_AVAILABLE_LINES,
    onSubmit,
    inputFixedAreaRef,
  }: SelectInputProps<T>,
  ref: React.ForwardedRef<DOMElement>,
): JSX.Element | null {
  let noItems = false

  if (rawItems.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
    rawItems = [{label: emptyMessage, value: null as any, disabled: true}]
    noItems = true
  }

  const hasAnyGroup = rawItems.some((item) => typeof item.group !== 'undefined')
  const items = sortBy(rawItems, 'group')
  const itemsHaveKeys = items.some((item) => typeof item.key !== 'undefined' && item.key.length > 0)

  if (itemsHaveKeys) validateKeys(items)

  const availableLinesToUse = Math.min(availableLines, MAX_AVAILABLE_LINES)

  function maximumLinesLostToGroups(items: Item<T>[]): number {
    // Calculate a safe estimate of the limit needed based on the space available
    const numberOfGroups = new Set(items.map((item) => item.group).filter((group) => group)).size
    // Add 1 to numberOfGroups because we also have a default Other group
    const maxVisibleGroups = Math.ceil(Math.min((availableLinesToUse + 1) / 3, numberOfGroups + 1))
    // If we have x visible groups, we lose 1 line to the first group + 2 lines to the rest
    return numberOfGroups > 0 ? (maxVisibleGroups - 1) * 2 + 1 : 0
  }

  const maxLinesLostToGroups = maximumLinesLostToGroups(items)
  const limit = Math.max(2, availableLinesToUse - maxLinesLostToGroups)
  const hasLimit = items.length > limit

  const state = useSelectState({
    visibleOptionCount: limit,
    options: items,
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
          if (onSubmit && item) {
            onSubmit(item)
          }

          state.selectOption({option: itemWithKey})
        }
      }
    },
    [items, onSubmit, state],
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
        handleShortcuts(input)
      } else {
        handleArrows(key)
      }
    },
    {isActive: focus},
  )
  const {twoThirds} = useLayout()

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
    const minHeight = hasAnyGroup ? 5 : 2
    const sectionHeight = Math.max(minHeight, Math.min(availableLinesToUse, optionsHeight))

    return (
      <Box flexDirection="column" ref={ref} gap={1} width={twoThirds}>
        <Box flexDirection="row" height={sectionHeight} width="100%">
          <Box flexDirection="column" overflowY="hidden" flexGrow={1}>
            {state.visibleOptions.map((item: Item<T>, index: number) => (
              <Item
                key={index}
                item={item}
                previousItem={state.visibleOptions[index - 1]}
                highlightedTerm={highlightedTerm}
                isSelected={item.value === state.value}
                items={state.visibleOptions}
                enableShortcuts={enableShortcuts}
                hasAnyGroup={hasAnyGroup}
                index={index}
              />
            ))}
          </Box>

          {hasLimit ? (
            <Scrollbar
              containerHeight={sectionHeight}
              visibleListSectionLength={limit}
              fullListLength={items.length}
              visibleFromIndex={state.visibleFromIndex}
            />
          ) : null}
        </Box>

        <Box ref={inputFixedAreaRef}>
          {noItems ? (
            <Box marginLeft={3}>
              <Text dimColor>Try again with a different keyword.</Text>
            </Box>
          ) : (
            <Box marginLeft={3} flexDirection="column">
              <Text dimColor>
                {`Press ${figures.arrowUp}${figures.arrowDown} arrows to select, enter ${
                  itemsHaveKeys ? 'or a shortcut ' : ''
                }to confirm.`}
              </Text>
              {hasMorePages ? (
                <Text>
                  <Text bold>1-{items.length} of many</Text>
                  {morePagesMessage ? `  ${morePagesMessage}` : null}
                </Text>
              ) : null}
            </Box>
          )}
        </Box>
      </Box>
    )
  }
}

export const SelectInput = forwardRef(SelectInputInner)
