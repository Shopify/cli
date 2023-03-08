import {isEqual} from '../../../../public/common/lang.js'
import {groupBy, partition} from '../../../../public/common/collection.js'
import {mapValues} from '../../../../public/common/object.js'
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react'
import {Box, Key, useInput, Text} from 'ink'
import {debounce} from '@shopify/cli-kit/common/function'
import chalk from 'chalk'
import figures from 'figures'

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

// eslint-disable-next-line react/function-component-definition
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
      {title ? (
        <Box marginLeft={3}>
          <Text bold>{title}</Text>
        </Box>
      ) : null}

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

// eslint-disable-next-line react/function-component-definition
function SelectInput<T>({
  items,
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
}: React.PropsWithChildren<SelectInputProps<T>>): JSX.Element | null {
  const defaultValueIndex = defaultValue ? items.findIndex((item) => item.value === defaultValue.value) : -1
  const initialIndex = defaultValueIndex === -1 ? 0 : defaultValueIndex
  const inputStack = useRef<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [groupedItems, ungroupedItems] = groupItems(items)
  const groupedItemsValues = useMemo(
    () => [...Object.values(groupedItems).flat(), ...ungroupedItems],
    [groupedItems, ungroupedItems],
  )
  const keys = groupedItemsValues.map((item) => item.key)
  const groupTitles = Object.keys(groupedItems)
  const previousItems = useRef<Item<T>[]>(items)

  const changeSelection = useCallback(
    ({index, usedShortcut = false}: {index: number; usedShortcut?: boolean}) => {
      const groupedItem = groupedItemsValues.find((item) => item.index === index)!
      setSelectedIndex(index)
      onChange({
        item: items.find((item) => item.value === groupedItem.value),
        usedShortcut,
      })
    },
    [groupedItemsValues, items, onChange],
  )

  useEffect(() => {
    if (items.length === 0) {
      // reset selection when items are empty
      onChange({
        item: undefined,
        usedShortcut: false,
      })
    } else if (
      // reset index when items change
      !isEqual(
        previousItems.current.map((item) => item.value),
        items.map((item) => item.value),
      )
    ) {
      changeSelection({index: 0})
    }

    previousItems.current = items
  }, [changeSelection, items, onChange])

  const handleArrows = (key: Key) => {
    const lastIndex = items.length - 1

    if (key.upArrow) {
      changeSelection({index: selectedIndex === 0 ? lastIndex : selectedIndex - 1})
    } else if (key.downArrow) {
      changeSelection({index: selectedIndex === lastIndex ? 0 : selectedIndex + 1})
    }
  }

  const handleShortcuts = useCallback(
    (input: string) => {
      if (keys.includes(input)) {
        const groupedItem = groupedItemsValues.find((item) => item.key === input)
        if (groupedItem !== undefined) {
          changeSelection({index: groupedItem.index, usedShortcut: true})
        }
      }
    },
    [changeSelection, groupedItemsValues, keys],
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
          />
        ))}

        {ungroupedItems.length > 0 && (
          <SelectItemsGroup
            title={ungroupedItemsTitle}
            selectedIndex={selectedIndex}
            items={ungroupedItems}
            hasMarginTop={groupTitles.length > 0}
            enableShortcuts={enableShortcuts}
            highlightedTerm={highlightedTerm}
          />
        )}

        <Box marginTop={1} marginLeft={3} flexDirection="column">
          {hasMorePages ? (
            <Text>
              <Text bold>1-{items.length} of many</Text>
              {morePagesMessage ? `  ${morePagesMessage}` : null}
            </Text>
          ) : null}
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

export {SelectInput}
