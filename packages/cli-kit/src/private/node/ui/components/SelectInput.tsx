import React, {useState, useEffect, useRef, useCallback} from 'react'
import {Box, Key, Text, useApp, useInput} from 'ink'
import {groupBy, isEqual, mapValues} from 'lodash-es'

export interface Props<T> {
  items: Item<T>[]
  onSelect: (item: Item<T>) => void
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
}

function groupItems<T>(items: Item<T>[]) {
  let index = 0

  return mapValues(groupBy(items, 'group'), (groupItems) =>
    groupItems.map((groupItem) => {
      const item = {...groupItem, key: groupItem.key ?? (index + 1).toString(), index}
      index += 1
      return item
    }),
  )
}

export default function SelectInput<T>({items, onSelect}: React.PropsWithChildren<Props<T>>): JSX.Element | null {
  const [inputStack, setInputStack] = useState<string | null>(null)
  const [inputTimeout, setInputTimeout] = useState<NodeJS.Timeout | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const keys = useRef(new Set(items.map((item) => item.key)))
  const {exit: unmountInk} = useApp()
  const groupedItems = groupItems(items)
  const groupTitles = Object.keys(groupedItems)

  const previousItems = useRef<Item<T>[]>(items)

  useEffect(() => {
    if (
      !isEqual(
        previousItems.current.map((item) => item.value),
        items.map((item) => item.value),
      )
    ) {
      setSelectedIndex(0)
    }

    previousItems.current = items
  }, [items])

  const handleInput = useCallback(
    (input: string, key: Key) => {
      if (input === 'c' && key.ctrl) {
        // Exceptions being throw in these hooks aren't being caught by our errorHandler.
        // See also how we handle exceptions in CouncurrentOutput for reference.
        process.exit(1)
      }

      const parsedInput = parseInt(input, 10)

      if (parsedInput !== 0 && parsedInput <= items.length + 1) {
        setSelectedIndex(parsedInput - 1)
      } else if (keys.current.has(input)) {
        const index = items.findIndex((item) => item.key === input)
        if (index !== -1) {
          setSelectedIndex(index)
        }
      }

      if (key.upArrow) {
        const lastIndex = items.length - 1

        setSelectedIndex(selectedIndex === 0 ? lastIndex : selectedIndex - 1)
      } else if (key.downArrow) {
        setSelectedIndex(selectedIndex === items.length - 1 ? 0 : selectedIndex + 1)
      } else if (key.return) {
        onSelect(items[selectedIndex]!)
        unmountInk()
      }
    },
    [selectedIndex, items, onSelect],
  )

  useInput((input, key) => {
    if (input.length > 0 && Object.values(key).every((value) => value === false)) {
      const newInputStack = inputStack === null ? input : inputStack + input

      setInputStack(newInputStack)

      if (inputTimeout !== null) {
        clearTimeout(inputTimeout)
      }

      setInputTimeout(
        setTimeout(() => {
          handleInput(newInputStack, key)
          setInputStack(null)
          setInputTimeout(null)
        }, 300),
      )
    } else {
      handleInput(input, key)
    }
  })

  return (
    <Box flexDirection="column">
      {groupTitles.map((title) => {
        const hasTitle = title !== 'undefined'

        return (
          <Box key={title} flexDirection="column" marginTop={hasTitle ? 1 : 0}>
            {hasTitle && (
              <Box marginLeft={3}>
                <Text bold>{title}</Text>
              </Box>
            )}
            {groupedItems[title]!.map((item) => {
              const isSelected = item.index === selectedIndex

              return (
                <Box key={item.key}>
                  <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>

                  <Text color={isSelected ? 'cyan' : undefined}>{`(${item.key}) ${item.label}`}</Text>
                </Box>
              )
            })}
          </Box>
        )
      })}

      <Box marginTop={1} marginLeft={3}>
        <Text dimColor>navigate with arrows, enter to select</Text>
      </Box>
    </Box>
  )
}
