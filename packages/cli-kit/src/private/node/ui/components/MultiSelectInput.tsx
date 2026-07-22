import {Item} from './SelectInput.js'
import {Scrollbar} from './Scrollbar.js'
import {DescriptionPanel, DESCRIPTION_PANEL_LINES_BELOW, MIN_SIDE_PANEL_WIDTH} from './DescriptionPanel.js'
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
  singleLine: boolean
}

function MultiSelectItem<T>({
  item,
  previousItem,
  isFocused,
  isSelected,
  items,
  hasAnyGroup,
  index,
  singleLine,
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

      <Box key={index} marginLeft={hasAnyGroup ? 3 : 0} width={singleLine ? '100%' : undefined}>
        <Box marginRight={2}>{isFocused ? <Text color="cyan">{`>`}</Text> : <Text> </Text>}</Box>
        <Box marginRight={1}>
          <Text color={isSelected ? 'cyan' : labelColor}>{checkbox}</Text>
        </Box>
        {/* When descriptions are active, keep every row to exactly one physical line so the list's
            true height equals the option count (what the scrollbar/sectionHeight already assume),
            which is what prevents the wrapped-row ghosting bug. Otherwise preserve the original
            wrapping behavior byte-for-byte. */}
        <Text wrap={singleLine ? 'truncate-end' : 'end'} color={labelColor}>
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
  const {fullWidth, twoThirds} = useLayout()

  // The description panel is opt-in: it only activates when at least one item provides a
  // description. When it does, rows become single-line/truncated and the focused item's
  // description is shown in a panel. In a multi-select the panel follows FOCUS (the `>` cursor),
  // not the set of toggled selections.
  const descriptionsEnabled = items.some((item) => (item.description?.length ?? 0) > 0)
  const highlightedItem = descriptionsEnabled ? items.find((item) => item.value === state.value) : undefined

  // useLayout clamps both `twoThirds` and `oneThird` up to a minimum of 80 columns, so they can't
  // be placed side-by-side on typical terminals without overflowing (which would reintroduce the
  // wrapped-row ghosting). Instead, keep the list at `twoThirds` and give the panel exactly the
  // remaining width, so the two columns always sum to `fullWidth`. Only place the panel beside the
  // list when that remainder is wide enough to be readable; otherwise stack it below.
  const sidePanelWidth = fullWidth - twoThirds
  const showDescriptionBeside = descriptionsEnabled && sidePanelWidth >= MIN_SIDE_PANEL_WIDTH

  const optionsHeight = initialItems.length + maximumLinesLostToGroups(initialItems)
  const minHeight = hasAnyGroup ? 5 : 2
  const sectionHeight = Math.max(minHeight, Math.min(availableLinesToUse, optionsHeight))

  const listSection = (
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
            {`Press ${figures.arrowUp}${figures.arrowDown} arrows to select, space to toggle, enter to confirm.`}
          </Text>
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

export {MultiSelectInput}
