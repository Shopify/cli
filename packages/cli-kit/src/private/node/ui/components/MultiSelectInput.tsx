import {Item} from './SelectInput.js'
import {Scrollbar} from './Scrollbar.js'
import {DescriptionPanel, MIN_SIDE_PANEL_WIDTH} from './DescriptionPanel.js'
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
        // Always keep the group title on a single physical line. Without this, a long title wraps to
        // 2+ rows, but `minHeight={title ? 2 : 1}` and `maximumLinesLostToGroups()` both assume a
        // one-line title, so the `overflowY="hidden"` list box would clip the focused option row.
        // The title Box stretches to the list column width, so `truncate-end` has a bound to clip to.
        <Box marginLeft={3}>
          <Text bold wrap="truncate-end">
            {title}
          </Text>
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

// Physical rows the stacked description hint (+ its gap) occupies below the list. Reserved out of
// the list's vertical budget so the list never fills the whole budget and then pushes the hint past
// the viewport (which reintroduced the vertical ghosting bug).
const STACKED_HINT_RESERVE = 2

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

  const {fullWidth, twoThirds} = useLayout()

  // The description panel is opt-in: it only activates when at least one item provides a
  // description. When it does, rows become single-line/truncated and the focused item's
  // description is shown in a panel. In a multi-select the panel follows FOCUS (the `>` cursor),
  // not the set of toggled selections.
  const descriptionsEnabled = items.some((item) => (item.description?.length ?? 0) > 0)

  // useLayout clamps both `twoThirds` and `oneThird` up to a minimum of 80 columns, so they can't
  // be placed side-by-side on typical terminals without overflowing (which would reintroduce the
  // wrapped-row ghosting). Instead, keep the list at `twoThirds` and give the panel exactly the
  // remaining width, so the two columns always sum to `fullWidth`. Only place the panel beside the
  // list when that remainder is wide enough to be readable; otherwise stack it below.
  const sidePanelWidth = fullWidth - twoThirds
  const showDescriptionBeside = descriptionsEnabled && sidePanelWidth >= MIN_SIDE_PANEL_WIDTH

  // `availableLines` is the real remaining vertical budget above the footer (see
  // Prompts/PromptLayout.tsx). Only the STACKED description case adds a line (+ gap) *below* the
  // list, so in that case we shrink the budget the list sizes itself against; otherwise the list
  // would fill the whole budget and then push the stacked hint past the viewport, reintroducing the
  // vertical ghosting bug. The beside/wide panel is side-by-side and costs no vertical rows, and the
  // no-description path keeps the full budget, so both stay byte-for-byte unchanged.
  const listAvailableLines =
    descriptionsEnabled && !showDescriptionBeside
      ? Math.max(2, availableLinesToUse - STACKED_HINT_RESERVE)
      : availableLinesToUse

  function maximumLinesLostToGroups(items: Item<T>[]): number {
    // Calculate a safe estimate of the limit needed based on the space available
    const numberOfGroups = new Set(items.map((item) => item.group).filter((group) => group)).size
    // Add 1 to numberOfGroups because we also have a default Other group
    const maxVisibleGroups = Math.ceil(Math.min((listAvailableLines + 1) / 3, numberOfGroups + 1))
    // If we have x visible groups, we lose 1 line to the first group + 2 lines to the rest
    return numberOfGroups > 0 ? (maxVisibleGroups - 1) * 2 + 1 : 0
  }

  const maxLinesLostToGroups = maximumLinesLostToGroups(items)
  const limit = Math.max(2, listAvailableLines - maxLinesLostToGroups)
  const hasLimit = items.length > limit

  const state = useSelectState({
    visibleOptionCount: limit,
    options: items,
    defaultValue: undefined,
  })

  // The panel follows FOCUS (the `>` cursor / `state.value`), not the toggled selection set.
  const highlightedItem = descriptionsEnabled ? items.find((item) => item.value === state.value) : undefined

  // Shift+Tab toggles a full-screen "detail" takeover of the focused item's description. It is only
  // meaningful when descriptions are on and the focused item actually has one.
  const [showFullDescription, setShowFullDescription] = useState(false)

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

      // Shift+Tab toggles the full-description takeover. TextInput ignores this exact combo, so it
      // is free to reuse across autocomplete/select/multi-select. Only react when there is a
      // description to show; otherwise leave the key alone.
      if (key.shift && key.tab) {
        if (descriptionsEnabled && (highlightedItem?.description?.length ?? 0) > 0) {
          setShowFullDescription((previous) => !previous)
        }
        return
      }

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

  const optionsHeight = initialItems.length + maximumLinesLostToGroups(initialItems)
  const minHeight = hasAnyGroup ? 5 : 2
  let sectionHeight = Math.max(minHeight, Math.min(listAvailableLines, optionsHeight))

  // STACKED description case only: the preview line (+ its gap) render *below* the list, so the
  // list plus that reserve must fit the real vertical budget. Treat the reserve as a HARD CEILING
  // and clamp AFTER the `minHeight` floor — otherwise a grouped list (`minHeight=5`) in a small
  // budget would push `sectionHeight + gap + preview` past the viewport and reintroduce the
  // vertical ghosting the reserve was meant to prevent. A tiny budget may show fewer rows / scroll
  // more; that tradeoff is accepted. `Math.max(1, …)` only guards against a non-positive height on
  // a pathologically short terminal — real terminals are ≥24 rows. The no-description and beside
  // paths are gated out here, so they stay byte-for-byte unchanged.
  //
  // KNOWN LIMITATION (accepted): this bounds the list's PHYSICAL height only — the LOGICAL row
  // budget (`limit`, passed to `useSelectState`) is untouched. A grouped item's smallest unit is 2
  // physical rows (`minHeight={title ? 2 : 1}`: group title + option row), so once the budget
  // leaves fewer rows than that group overhead, the clamped box renders the group title and
  // `overflowY="hidden"` clips the focused option's row. At `availableLines=3` the list is a single
  // row and shows only the title, so the focused option's label is not visible at all. Clipping a
  // row at a budget no real terminal reaches beats dropping the clamp and reintroducing the
  // ghosting. Pinned by the "documented limitation" test in MultiSelectInput.description.test.tsx.
  if (descriptionsEnabled && !showDescriptionBeside) {
    sectionHeight = Math.min(sectionHeight, Math.max(1, availableLinesToUse - STACKED_HINT_RESERVE))
  }

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
            {`Press ${figures.arrowUp}${figures.arrowDown} arrows to select, space to toggle, enter to confirm.${
              descriptionsEnabled ? ' · ⇧⇥ full description' : ''
            }`}
          </Text>
        </Box>
      )}
    </Box>
  )

  // Shift+Tab takeover: replace the list + hint with the focused item's full description. Arrows
  // still navigate underneath, so this updates live as the focused item changes.
  if (descriptionsEnabled && showFullDescription && (highlightedItem?.description?.length ?? 0) > 0) {
    const overlayWidth = showDescriptionBeside ? fullWidth : twoThirds
    return (
      <Box flexDirection="column" ref={ref} gap={1} width={overlayWidth}>
        <DescriptionPanel
          title={highlightedItem?.label}
          description={highlightedItem?.description}
          width={overlayWidth}
          maxLines={availableLinesToUse}
        />
        <Box marginLeft={3}>
          <Text dimColor>Press ⇧⇥ to go back.</Text>
        </Box>
      </Box>
    )
  }

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

  // Narrow terminals: show only a single, truncated preview line of the focused item's description
  // below the list (the focused row already shows its label). This costs exactly one row (reserved
  // via `listAvailableLines`), keeping the total height within the viewport. The full text is one
  // Shift+Tab away. The box stretches to `twoThirds`, so `marginLeft` leaves a bound for
  // `truncate-end` to clip against.
  return (
    <Box flexDirection="column" ref={ref} gap={1} width={twoThirds}>
      {listSection}
      <Box marginLeft={3}>
        <Text dimColor wrap="truncate-end">
          {highlightedItem?.description}
        </Text>
      </Box>
      {footer}
    </Box>
  )
}

export {MultiSelectInput}
