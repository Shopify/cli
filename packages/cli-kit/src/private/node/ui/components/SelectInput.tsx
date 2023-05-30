import {isEqual} from '../../../../public/common/lang.js'
import {debounce} from '../../../../public/common/function.js'
import React, {useState, useEffect, useRef, useCallback, forwardRef} from 'react'
import {Box, Key, useInput, useStdout, Text, DOMElement} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import {createRequire} from 'module'
import ansiEscapes from 'ansi-escapes'

const require = createRequire(import.meta.url)

declare module 'react' {
  function forwardRef<T, P>(
    render: (props: P, ref: React.Ref<T>) => JSX.Element | null,
  ): (props: P & React.RefAttributes<T>) => JSX.Element | null
}

function rotateArray<T>(array: T[], rotation?: number) {
  const arrayCopy = array.slice()
  return arrayCopy.splice(-(rotation ?? 0) % arrayCopy.length).concat(arrayCopy)
}

interface OnChangeOptions<T> {
  item: Item<T> | undefined
  usedShortcut: boolean
}
export interface SelectInputProps<T> {
  items: Item<T>[]
  onChange: ({item, usedShortcut}: OnChangeOptions<T>) => void
  enableShortcuts?: boolean
  focus?: boolean
  emptyMessage?: string
  defaultValue?: Item<T>
  highlightedTerm?: string
  loading?: boolean
  errorMessage?: string
  hasMorePages?: boolean
  morePagesMessage?: string
  infoMessage?: string
  availableLines: number
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
}

interface ItemWithKey<T> extends Item<T> {
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
  nextItem: ItemWithKey<T> | undefined
  items: ItemWithKey<T>[]
  allItems: ItemWithKey<T>[]
  selectedIndex: number
  highlightedTerm?: string
  enableShortcuts: boolean
  hasAnyGroup: boolean
}

// eslint-disable-next-line react/function-component-definition
function Item<T>({
  item,
  previousItem,
  nextItem,
  selectedIndex,
  highlightedTerm,
  enableShortcuts,
  items,
  allItems,
  hasAnyGroup,
}: ItemProps<T>): JSX.Element {
  const isSelected = items.indexOf(item) === selectedIndex
  const label = highlightedLabel(item.label, highlightedTerm)
  let title: string | undefined

  if (typeof previousItem === 'undefined' || item.group !== previousItem.group) {
    title = item.group ?? (hasAnyGroup ? 'Other' : undefined)
  }
  const isLastInGroup = (typeof nextItem === 'undefined' || item.group !== nextItem.group) && hasAnyGroup

  const maxGroupWidth = Math.max(...allItems.map((item) => item.group?.length || 0))
  const leftSideWidth = Math.min(maxGroupWidth, 28) + 8
  const rightSideWidth = Math.max(...allItems.map((item) => item.label.length)) + 3


  return (
    <Box key={item.key} flexDirection="row" minHeight={isLastInGroup ? 2 : 1} width={leftSideWidth + rightSideWidth + 4}>
      {hasAnyGroup ? (
        <Box
          marginLeft={1}
          marginRight={0}
          key={title}
          flexDirection="column"
          width={leftSideWidth}
          alignItems="flex-end"
        >
          <Text bold>{title ?? ''}</Text>
        </Box>
      ) : null}
      <Box key={item.label} marginLeft={0} width={leftSideWidth + rightSideWidth}>
        <Box marginRight={1} marginLeft={0}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        <Text color={isSelected ? 'cyan' : undefined}>
          {enableShortcuts ? `(${item.key}) ${label}` : label}
        </Text>
      </Box>
    </Box>
  )
}

// eslint-disable-next-line react/function-component-definition
function SelectInputInner<T>(
  {
    items: initialItems,
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
    availableLines,
  }: SelectInputProps<T>,
  ref: React.ForwardedRef<DOMElement>,
): JSX.Element | null {
  const sortBy = require('lodash/sortBy')
  const hasAnyGroup = initialItems.some((item) => typeof item.group !== 'undefined')
  const items = sortBy(initialItems, 'group') as Item<T>[]
  const itemsWithKeys = items.map((item, index) => ({
    ...item,
    key: item.key ?? (index + 1).toString(),
  })) as ItemWithKey<T>[]

  const numberOfGroups = new Set(items.map((item) => item.group)).size
  const limit = calculateLimit(availableLines, numberOfGroups, items.length)
  const hasLimit = items.length > limit

  const defaultValueIndex = defaultValue ? items.findIndex((item) => item.value === defaultValue.value) : -1
  const initialIndex = defaultValueIndex === -1 ? 0 : defaultValueIndex
  const inputStack = useRef<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [rotateIndex, setRotateIndex] = useState(0)

  const slicedItemsWithKeys = hasLimit ? rotateArray(itemsWithKeys, rotateIndex) : itemsWithKeys
  const previousItems = useRef<Item<T>[] | undefined>(undefined)

  const changeSelection = useCallback(
    ({
      newSelectedIndex,
      newRotateIndex,
      usedShortcut = false,
    }: {
      newSelectedIndex: number
      usedShortcut?: boolean
      newRotateIndex?: number
    }) => {
      setSelectedIndex(newSelectedIndex)
      if (typeof newRotateIndex !== 'undefined') setRotateIndex(newRotateIndex)

      const rotatedItems = hasLimit ? rotateArray(items, newRotateIndex).slice(0, limit) : items

      onChange({
        item: rotatedItems[newSelectedIndex],
        usedShortcut,
      })
    },
    [hasLimit, items, limit, onChange],
  )

  useEffect(() => {
    if (items.length === 0) {
      // reset selection when items are empty
      onChange({
        item: undefined,
        usedShortcut: false,
      })
      // reset index when items change or the first time
    } else if (!previousItems.current) {
      changeSelection({newSelectedIndex: initialIndex, newRotateIndex: 0})
    } else if (
      !isEqual(
        previousItems.current.map((item) => item.value),
        items.map((item) => item.value),
      )
    ) {
      changeSelection({newSelectedIndex: 0, newRotateIndex: 0})
    }

    previousItems.current = items
  }, [changeSelection, initialIndex, items, onChange])

  const handleArrows = (key: Key) => {
    if (key.upArrow) {
      const lastIndex = items.length - 1
      const atFirstIndex = selectedIndex === 0
      const nextIndex = hasLimit ? selectedIndex : lastIndex
      const nextRotateIndex = atFirstIndex ? rotateIndex + 1 : rotateIndex
      const nextSelectedIndex = atFirstIndex ? nextIndex : selectedIndex - 1

      changeSelection({newSelectedIndex: nextSelectedIndex, newRotateIndex: nextRotateIndex})
    } else if (key.downArrow) {
      const atLastIndex = selectedIndex === (hasLimit ? limit : items.length) - 1
      const nextIndex = hasLimit ? selectedIndex : 0
      const shouldRotate = hasLimit && selectedIndex >= availableLines / 2 - 1
      const nextRotateIndex = shouldRotate ? rotateIndex - 1 : rotateIndex

      const nextSelectedIndex = (shouldRotate || atLastIndex) ? nextIndex : selectedIndex + 1

      changeSelection({newSelectedIndex: nextSelectedIndex, newRotateIndex: nextRotateIndex})
    }
  }

  const handleShortcuts = useCallback(
    (input: string) => {
      if (slicedItemsWithKeys.map((item) => item.key).includes(input)) {
        const itemWithKey = slicedItemsWithKeys.find((item) => item.key === input)
        if (itemWithKey !== undefined) {
          changeSelection({
            newSelectedIndex: items.findIndex((item) => item.value === itemWithKey.value),
            usedShortcut: true,
          })
        }
      }
    },
    [changeSelection, items, slicedItemsWithKeys],
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
  } else if (items.length === 0) {
    return (
      <Box marginLeft={3}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    )
  } else {
    return (
      <Box flexDirection="column" ref={ref}>
        <Box height={Math.min(availableLines, items.length + numberOfGroups)} flexDirection="column" flexWrap="nowrap" overflowY="hidden">
          {slicedItemsWithKeys.map((item, index) => (
            <Item
              key={item.key}
              item={item}
              previousItem={slicedItemsWithKeys[index - 1]}
              nextItem={slicedItemsWithKeys[index + 1]}
              highlightedTerm={highlightedTerm}
              selectedIndex={selectedIndex}
              items={slicedItemsWithKeys}
              allItems={itemsWithKeys}
              enableShortcuts={enableShortcuts}
              hasAnyGroup={hasAnyGroup}
            />
          ))}
        </Box>

        <Box marginTop={1} marginLeft={3} flexDirection="column">
          {hasMorePages ? (
            <Text>
              <Text bold>1-{items.length} of many</Text>
              {morePagesMessage ? `  ${morePagesMessage}` : null}
            </Text>
          ) : null}
          {hasLimit ? <Text dimColor>{`${items.length} options available.`}</Text> : null}
          <Text dimColor>
            {infoMessage
              ? infoMessage
              : `Press ${figures.arrowUp}${figures.arrowDown} arrows to select, enter to confirm`}
          </Text>
        </Box>
      </Box>
    )
  }
}

const calculateLimit = function(availableLines: number, numGroups: number, numItems: number) {
  // Calculate a rough estimate of the limit needed based on the space available.
  // Always ensure at least 2 items are displayed.

  // We lose a line every time a new group appears past the first.
  // If we have many groups, a maximum of availableLines / 2 groups can appear.
  // With few groups, a maximum of numberOfGroups groups can appear.
  // If there are no groups, we don't lose any lines.
  const maxLinesLostToGroups = Math.max(0, Math.min(availableLines / 2, numGroups) - 1)

  const newLimit = Math.max(2, availableLines - maxLinesLostToGroups)

  useStdout().write(ansiEscapes.clearTerminal)

  return Math.min(Math.floor(newLimit), numItems)
}

export const SelectInput = forwardRef(SelectInputInner)
