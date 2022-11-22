import React, {useState, useEffect, useRef, useCallback} from 'react'
import {Box, Text, useInput} from 'ink'
import {isEqual} from 'lodash-es'

function arrayRotate<T>(array: T[], count?: number) {
  const slice = array.slice()
  return slice.splice(-(count ?? 0) % slice.length).concat(slice)
}

export interface Props {
  /**
   * Items to display in a list. Each item must be an object and have `label` and `value` props.
   */
  items?: Item[]

  /**
   * Index of initially-selected item in `items` array.
   */
  initialIndex?: number

  /**
   * Number of items to display.
   */
  limit?: number

  /**
   * Function to call when user selects an item. Item object is passed to that function as an argument.
   */
  onSelect: (item: Item) => void
}

export interface Item {
  label: string
  value: string
  key?: string
}

const SelectInput: React.FC<Props> = ({items = [], initialIndex = 0, limit: customLimit, onSelect}): JSX.Element => {
  const [rotateIndex, setRotateIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const hasLimit = typeof customLimit === 'number' && items.length > customLimit
  const limit = hasLimit ? Math.min(customLimit, items.length) : items.length
  const keys = useRef(new Set(items.map((item) => item.key)))

  const previousItems = useRef<Item[]>(items)

  useEffect(() => {
    if (
      !isEqual(
        previousItems.current.map((item) => item.value),
        items.map((item) => item.value),
      )
    ) {
      setRotateIndex(0)
      setSelectedIndex(0)
    }

    previousItems.current = items
  }, [items])

  useInput(
    useCallback(
      (input, key) => {
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
          const lastIndex = (hasLimit ? limit : items.length) - 1
          const atFirstIndex = selectedIndex === 0
          const nextIndex = hasLimit ? selectedIndex : lastIndex
          const nextRotateIndex = atFirstIndex ? rotateIndex + 1 : rotateIndex
          const nextSelectedIndex = atFirstIndex ? nextIndex : selectedIndex - 1

          setRotateIndex(nextRotateIndex)
          setSelectedIndex(nextSelectedIndex)
        } else if (key.downArrow) {
          const atLastIndex = selectedIndex === (hasLimit ? limit : items.length) - 1
          const nextIndex = hasLimit ? selectedIndex : 0
          const nextRotateIndex = atLastIndex ? rotateIndex - 1 : rotateIndex
          const nextSelectedIndex = atLastIndex ? nextIndex : selectedIndex + 1

          setRotateIndex(nextRotateIndex)
          setSelectedIndex(nextSelectedIndex)
        } else if (key.return) {
          const slicedItems = hasLimit ? arrayRotate(items, rotateIndex).slice(0, limit) : items

          onSelect(slicedItems[selectedIndex]!)
        }
      },
      [hasLimit, limit, rotateIndex, selectedIndex, items, onSelect],
    ),
  )

  const slicedItems = hasLimit ? arrayRotate(items, rotateIndex).slice(0, limit) : items

  return (
    <Box flexDirection="column">
      {slicedItems.map((item, index) => {
        const isSelected = index === selectedIndex

        return (
          <Box key={item.value}>
            <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>

            <Text color={isSelected ? 'cyan' : undefined}>{`(${item.key ?? index + 1}) ${item.label}`}</Text>
          </Box>
        )
      })}

      <Box marginTop={1} marginLeft={3}>
        <Text dimColor>navigate with arrows, enter to select</Text>
      </Box>
    </Box>
  )
}

export default SelectInput
