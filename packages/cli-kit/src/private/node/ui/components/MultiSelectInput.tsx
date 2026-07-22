import {Item} from './SelectInput.js'
import {Scrollbar} from './Scrollbar.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {useSelectState} from '../hooks/use-select-state.js'
import React, {useCallback, useState} from 'react'
import {Box, Key, useInput, Text, DOMElement} from 'ink'
import figures from 'figures'
import sortBy from 'lodash/sortBy.js'

export interface MultiSelectInputProps<T> {
  items: Item<T>[]
  initialItems?: Item<T>[]
  focus?: boolean
  emptyMessage?: string
  defaultValue?: T[]
  availableLines?: number
  onSubmit?: (items: Item<T>[]) => void
  inputFixedAreaRef?: React.Ref<DOMElement>
  ref?: React.Ref<DOMElement>
  groupOrder?: string[]
}

interface MultiSelectItemProps<T> {
  item: Item<T>
  previousItem: Item<T> | undefined
  items: Item<T>[]
  isFocused: boolean
  isSelected: boolean
  hasAnyGroup: boolean
  index: number
}

function MultiSelectItem<T>({
  item,
  previousItem,
  isFocused,
  isSelected,
  items,
  hasAnyGroup,
  index,
}: MultiSelectItemProps<T>): React.ReactElement {
  let title: string | undefined
  let labelColor

  if (isFocused) {
    labelColor = 'cyan'
  } else if (item.disabled) {
    labelColor = 'dim'
  }

  if (typeof previousItem === 'undefined' || item.group !== previousItem.group) {
    title = item.group ?? (hasAnyGroup ? 'Other' : undefined)
  }

  const checkbox = isSelected ? figures.checkboxOn : figures.checkboxOff

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
        <Box marginRight={2}>{isFocused ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        <Box marginRight={1}>
          <Text color={isSelected ? 'cyan' : labelColor}>{checkbox}</Text>
        </Box>
        <Text wrap="end" color={labelColor}>
          {item.label}
        </Text>
      </Box>
    </Box>
  )
}

const MAX_AVAILABLE_LINES = 25

function MultiSelectInput<T>({
  items: rawItems,
  initialItems = rawItems,
  focus = true,
  emptyMessage = 'No items to select.',
  defaultValue,
  availableLines = MAX_AVAILABLE_LINES,
  onSubmit,
  inputFixedAreaRef,
  ref,
  groupOrder,
}: MultiSelectInputProps<T>): React.ReactElement | null {
  let noItems = false

  if (rawItems.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
    rawItems = [{label: emptyMessage, value: null as any, disabled: true}]
    noItems = true
  }

  const hasAnyGroup = rawItems.some((item) => typeof item.group !== 'undefined')
  const items = sortBy(rawItems, (item) => {
    // Items without groups ("Other") always go last
    if (!item.group) return Number.MAX_SAFE_INTEGER + 1
    // If no groupOrder specified, use default behavior
    if (!groupOrder) return Number.MAX_SAFE_INTEGER
    // Items with groups get their position from groupOrder, or MAX_SAFE_INTEGER if not specified
    const index = groupOrder.indexOf(item.group)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  })

  // The set of values the user has toggled on. Selecting zero items is valid,
  // so this can legitimately be empty when the prompt is submitted.
  const [selectedValues, setSelectedValues] = useState<Set<T>>(() => new Set(defaultValue ?? []))

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
    defaultValue: undefined,
  })

  const handleArrows = (key: Key) => {
    if (key.upArrow) {
      state.selectPreviousOption()
    } else if (key.downArrow) {
      state.selectNextOption()
    }
  }

  const toggleFocusedOption = useCallback(() => {
    if (typeof state.value === 'undefined') {
      return
    }

    const focusedItem = items.find((item) => item.value === state.value)

    if (!focusedItem || focusedItem.disabled) {
      return
    }

    setSelectedValues((previousValues) => {
      const nextValues = new Set(previousValues)

      if (nextValues.has(focusedItem.value)) {
        nextValues.delete(focusedItem.value)
      } else {
        nextValues.add(focusedItem.value)
      }

      return nextValues
    })
  }, [items, state.value])

  useInput(
    (input, key) => {
      handleCtrlC(input, key)

      if (key.return) {
        if (onSubmit && !noItems) {
          // Resolve in the order the choices were declared, not the order the
          // user toggled them nor the group-sorted display order. `items` is
          // sorted by group, so we filter `initialItems` (the original,
          // declared-order choices) to honour the stable-result contract.
          onSubmit(initialItems.filter((item) => selectedValues.has(item.value)))
        }
        return
      }

      // Space toggles the focused option. Guard against other modifiers so we
      // don't toggle when e.g. shift or control is held.
      if (input === ' ' && Object.values(key).every((value) => !value)) {
        toggleFocusedOption()
      } else {
        handleArrows(key)
      }
    },
    {isActive: focus},
  )
  const {twoThirds} = useLayout()

  const optionsHeight = initialItems.length + maximumLinesLostToGroups(initialItems)
  const minHeight = hasAnyGroup ? 5 : 2
  const sectionHeight = Math.max(minHeight, Math.min(availableLinesToUse, optionsHeight))

  return (
    <Box flexDirection="column" ref={ref} gap={1} width={twoThirds}>
      <Box flexDirection="row" height={sectionHeight} width="100%">
        <Box flexDirection="column" overflowY="hidden" flexGrow={1}>
          {state.visibleOptions.map((item: Item<T>, index: number) => (
            <MultiSelectItem
              key={index}
              item={item}
              previousItem={state.visibleOptions[index - 1]}
              isFocused={item.value === state.value}
              isSelected={selectedValues.has(item.value)}
              items={state.visibleOptions}
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
              {`Press ${figures.arrowUp}${figures.arrowDown} arrows to select, space to toggle, enter to confirm.`}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export {MultiSelectInput}
