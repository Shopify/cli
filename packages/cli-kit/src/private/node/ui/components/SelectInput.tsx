import {isEqual} from '../../../../public/common/lang.js'
import {groupBy, partition} from '../../../../public/common/collection.js'
import {mapValues} from '../../../../public/common/object.js'
import React, {useState, useEffect, useRef, useCallback} from 'react'
import {Box, Key, useInput, Text} from 'ink'
import {debounce} from '@shopify/cli-kit/common/function'
import chalk from 'chalk'
import figures from 'figures'

export interface Props<T> {
  items: Item<T>[]
  onChange: (item: Item<T> | undefined) => void
  enableShortcuts?: boolean
  focus?: boolean
  emptyMessage?: string
  defaultValue?: Item<T>
  highlightedTerm?: string
  loading?: boolean
  errorMessage?: string
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
}

interface ItemWithIndex<T> extends Item<T> {
  key: string
  index: number
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

function groupItems<T>(items: Item<T>[]): [{[key: string]: ItemWithIndex<T>[]}, ItemWithIndex<T>[]] {
  let index = 0

  const [withGroup, withoutGroup] = partition(items, 'group')

  const withGroupMapped = mapValues(groupBy(withGroup, 'group'), (groupItems) =>
    groupItems.map((groupItem) => {
      const item = {...groupItem, key: groupItem.key ?? (index + 1).toString(), index}
      index += 1
      return item
    }),
  )
  const withoutGroupMapped = withoutGroup.map((item) => {
    const newItem = {...item, key: item.key ?? (index + 1).toString(), index}
    index += 1
    return newItem
  })

  return [withGroupMapped, withoutGroupMapped]
}

interface SelectItemsGroupProps<T> {
  title: string | undefined
  items: ItemWithIndex<T>[]
  selectedIndex: number
  hasMarginTop: boolean
  enableShortcuts: boolean
  highlightedTerm?: string
}

function SelectItemsGroup<T>({
  title,
  items,
  selectedIndex,
  hasMarginTop,
  enableShortcuts,
  highlightedTerm,
}: SelectItemsGroupProps<T>): JSX.Element {
  return (
    <Box key={title} flexDirection="column" marginTop={hasMarginTop ? 1 : 0}>
      {title && (
        <Box marginLeft={3}>
          <Text bold>{title}</Text>
        </Box>
      )}

      {items.map((item) => {
        const isSelected = item.index === selectedIndex
        const label = highlightedLabel(item.label, highlightedTerm)

        return (
          <Box key={item.key}>
            <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>

            <Text color={isSelected ? 'cyan' : undefined}>{enableShortcuts ? `(${item.key}) ${label}` : label}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export default function SelectInput<T>({
  items,
  onChange,
  enableShortcuts = true,
  focus = true,
  emptyMessage = 'No items to select.',
  defaultValue,
  highlightedTerm,
  loading = false,
  errorMessage,
}: React.PropsWithChildren<Props<T>>): JSX.Element | null {
  const defaultValueIndex = defaultValue ? items.findIndex((item) => item.value === defaultValue.value) : -1
  const initialIndex = defaultValueIndex === -1 ? 0 : defaultValueIndex
  const inputStack = useRef<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [groupedItems, ungroupedItems] = groupItems(items)
  const groupedItemsValues = [...Object.values(groupedItems).flat(), ...ungroupedItems]
  const keys = groupedItemsValues.map((item) => item.key)
  const groupTitles = Object.keys(groupedItems)
  const previousItems = useRef<Item<T>[]>(items)

  const changeSelection = useCallback(
    (index: number) => {
      const groupedItem = groupedItemsValues.find((item) => item.index === index)!
      setSelectedIndex(index)
      onChange(items.find((item) => item.value === groupedItem.value))
    },
    [items],
  )

  useEffect(() => {
    if (items.length === 0) {
      // reset selection when items are empty
      onChange(undefined)
    } else if (
      // reset index when items change
      !isEqual(
        previousItems.current.map((item) => item.value),
        items.map((item) => item.value),
      )
    ) {
      changeSelection(0)
    }

    previousItems.current = items
  }, [items])

  const handleArrows = useCallback(
    (key: Key) => {
      const lastIndex = items.length - 1

      if (key.upArrow) {
        changeSelection(selectedIndex === 0 ? lastIndex : selectedIndex - 1)
      } else if (key.downArrow) {
        changeSelection(selectedIndex === lastIndex ? 0 : selectedIndex + 1)
      }
    },
    [selectedIndex, items],
  )

  const handleShortcuts = useCallback(
    (input: string) => {
      if (keys.includes(input)) {
        const groupedItem = groupedItemsValues.find((item) => item.key === input)
        if (groupedItem !== undefined) {
          changeSelection(groupedItem.index)
        }
      }
    },
    [items],
  )

  const debounceHandleShortcuts = useCallback(
    debounce((newInputStack) => {
      handleShortcuts(newInputStack)
      inputStack.current = null
    }, 300),
    [],
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

  const ungroupedItemsTitle = groupTitles.length > 0 ? 'Other' : undefined

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
      <Box flexDirection="column">
        {groupTitles.map((title, index) => (
          <SelectItemsGroup
            title={title}
            selectedIndex={selectedIndex}
            items={groupedItems[title]!}
            key={title}
            hasMarginTop={index !== 0}
            enableShortcuts={enableShortcuts}
            highlightedTerm={highlightedTerm}
          ></SelectItemsGroup>
        ))}

        {ungroupedItems.length > 0 && (
          <SelectItemsGroup
            title={ungroupedItemsTitle}
            selectedIndex={selectedIndex}
            items={ungroupedItems}
            hasMarginTop={groupTitles.length > 0}
            enableShortcuts={enableShortcuts}
            highlightedTerm={highlightedTerm}
          ></SelectItemsGroup>
        )}

        <Box marginTop={1} marginLeft={3}>
          <Text dimColor>
            Press {figures.arrowUp}
            {figures.arrowDown} arrows to select, enter to confirm
          </Text>
        </Box>
      </Box>
    )
  }
}
