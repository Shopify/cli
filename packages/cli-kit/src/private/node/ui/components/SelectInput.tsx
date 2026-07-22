import {Scrollbar} from './Scrollbar.js'
import {DescriptionPanel, DESCRIPTION_PANEL_LINES_BELOW, MIN_SIDE_PANEL_WIDTH} from './DescriptionPanel.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {useSelectState} from '../hooks/use-select-state.js'
import React, {useCallback, useEffect} from 'react'
import {Box, Key, useInput, Text, DOMElement} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import sortBy from 'lodash/sortBy.js'

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
  inputFixedAreaRef?: React.Ref<DOMElement>
  ref?: React.Ref<DOMElement>
  groupOrder?: string[]
}

export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
  helperText?: string
  disabled?: boolean
  /**
   * Optional longer description of the item. When at least one visible item provides a
   * description, the list renders names-only, single-line rows and shows the highlighted
   * item's description in a responsive side/below panel.
   */
  description?: string
}

function highlightedLabel(label: string, term: string | undefined) {
  if (!term) {
    return label
  }

  let regex
  try {
    regex = new RegExp(term, 'i')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // term is user provided and could be an invalid regex at that moment (e.g. ending in '\')
    return label
  }
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
  singleLine: boolean
}

function Item<T>({
  item,
  previousItem,
  isSelected,
  highlightedTerm,
  enableShortcuts,
  items,
  hasAnyGroup,
  index,
  singleLine,
}: ItemProps<T>): React.ReactElement {
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

      <Box key={index} marginLeft={hasAnyGroup ? 3 : 0} width={singleLine ? '100%' : undefined}>
        <Box marginRight={2}>{isSelected ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        {/* When descriptions are active, keep every row to exactly one physical line so the list's
            true height equals the option count (what the scrollbar/sectionHeight already assume),
            which is what prevents the wrapped-row ghosting bug. Otherwise preserve the original
            wrapping behavior byte-for-byte. */}
        <Text wrap={singleLine ? 'truncate-end' : 'end'} color={labelColor}>
          {showKey ? `(${item.key}) ${label}` : label}
        </Text>
      </Box>
    </Box>
  )
}

const MAX_AVAILABLE_LINES = 25

function SelectInput<T>({
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
  ref,
  groupOrder,
}: SelectInputProps<T>): React.ReactElement | null {
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
      if (enableShortcuts && input.length > 0 && Object.values(key).every((value) => !value)) {
        handleShortcuts(input)
      } else {
        handleArrows(key)
      }
    },
    {isActive: focus},
  )
  const {fullWidth, twoThirds} = useLayout()

  // The description panel is opt-in: it only activates when at least one item provides a
  // description. When it does, rows become single-line/truncated and the highlighted item's
  // description is shown in a panel.
  const descriptionsEnabled = items.some((item) => (item.description?.length ?? 0) > 0)
  const highlightedItem = descriptionsEnabled ? items.find((item) => item.value === state.value) : undefined

  // useLayout clamps both `twoThirds` and `oneThird` up to a minimum of 80 columns, so they can't
  // be placed side-by-side on typical terminals without overflowing (which would reintroduce the
  // wrapped-row ghosting). Instead, keep the list at `twoThirds` and give the panel exactly the
  // remaining width, so the two columns always sum to `fullWidth`. Only place the panel beside the
  // list when that remainder is wide enough to be readable; otherwise stack it below.
  const sidePanelWidth = fullWidth - twoThirds
  const showDescriptionBeside = descriptionsEnabled && sidePanelWidth >= MIN_SIDE_PANEL_WIDTH

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

    const listSection = (
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
              singleLine={descriptionsEnabled}
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
    )

    const footer = (
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
    )

    // No description on any item: render exactly as before (byte-for-byte).
    if (!descriptionsEnabled) {
      return (
        <Box flexDirection="column" ref={ref} gap={1} width={twoThirds}>
          {listSection}
          {footer}
        </Box>
      )
    }

    // Wide terminals: list and panel side-by-side. The panel matches the list's height so the
    // combined block stays bounded to `sectionHeight`.
    if (showDescriptionBeside) {
      return (
        <Box flexDirection="column" ref={ref} gap={1} width={fullWidth}>
          <Box flexDirection="row" width="100%">
            <Box width={twoThirds}>{listSection}</Box>
            <DescriptionPanel
              title={highlightedItem?.label}
              description={highlightedItem?.description}
              width={sidePanelWidth}
              maxLines={sectionHeight}
            />
          </Box>
          {footer}
        </Box>
      )
    }

    // Narrow terminals: panel stacked below the list, bounded to a few lines.
    return (
      <Box flexDirection="column" ref={ref} gap={1} width={twoThirds}>
        {listSection}
        <DescriptionPanel
          title={highlightedItem?.label}
          description={highlightedItem?.description}
          width={twoThirds}
          maxLines={DESCRIPTION_PANEL_LINES_BELOW}
        />
        {footer}
      </Box>
    )
  }
}

export {SelectInput}
