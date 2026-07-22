import {Item} from '../components/SelectInput.js'
import {useReducer, useCallback, useMemo, useState} from 'react'
import {isDeepStrictEqual} from 'node:util'

type Option<T> = Item<T>

type OptionMapItem<T> = Option<T> & {
  previous: OptionMapItem<T> | undefined
  next: OptionMapItem<T> | undefined
  index: number
}

export default class OptionMap<T> extends Map<T, OptionMapItem<T>> {
  readonly first: OptionMapItem<T> | undefined

  constructor(options: Option<T>[]) {
    const items: [T, OptionMapItem<T>][] = []
    let firstItem: OptionMapItem<T> | undefined
    let previous: OptionMapItem<T> | undefined
    let index = 0

    for (const option of options) {
      const item = {
        ...option,
        previous,
        next: undefined,
        index,
      }

      if (previous) {
        previous.next = item
      }

      firstItem ??= item

      items.push([option.value, item])
      index++
      previous = item
    }

    super(items)
    this.first = firstItem
  }
}

interface State<T> {
  /**
   * Map where key is option's value and value is option's index.
   */
  optionMap: OptionMap<T>

  /**
   * Number of visible options.
   */
  visibleOptionCount: number

  /**
   * Index of the first visible option.
   */
  visibleFromIndex: number

  /**
   * Index of the last visible option.
   */
  visibleToIndex: number

  /**
   * Value of the previously selected option.
   */
  previousValue: T | undefined

  /**
   * Value of the selected option.
   */
  value: T | undefined
}

type Action<T> =
  | SelectNextOptionAction
  | SelectPreviousOptionAction
  | SelectOptionAction<T>
  | ResetAction<T>
  | AdjustVisibleWindowAction

interface SelectNextOptionAction {
  type: 'select-next-option'
}

interface SelectPreviousOptionAction {
  type: 'select-previous-option'
}

interface SelectOptionAction<T> {
  type: 'select-option'
  option: Option<T>
}

interface ResetAction<T> {
  type: 'reset'
  state: State<T>
}

interface AdjustVisibleWindowAction {
  type: 'adjust-visible-window'
  visibleOptionCount: number
}

const reducer = <T>(state: State<T>, action: Action<T>): State<T> => {
  switch (action.type) {
    case 'select-next-option': {
      if (typeof state.value === 'undefined') {
        return state
      }

      const item = state.optionMap.get(state.value)

      if (!item) {
        return state
      }

      let next = item.next

      while (next && next.disabled) {
        next = next.next
      }

      if (!next) {
        return state
      }

      const needsToScroll = next.index > state.visibleToIndex

      if (!needsToScroll) {
        return {
          ...state,
          value: next.value,
        }
      }

      const nextVisibleToIndex = next.index
      const nextVisibleFromIndex = nextVisibleToIndex - state.visibleOptionCount + 1

      return {
        ...state,
        value: next.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
        previousValue: state.value,
      }
    }

    case 'select-previous-option': {
      if (typeof state.value === 'undefined') {
        return state
      }

      const item = state.optionMap.get(state.value)

      if (!item) {
        return state
      }

      let previous = item.previous

      while (previous && previous.disabled) {
        previous = previous.previous
      }

      if (!previous) {
        return state
      }

      const needsToScroll = previous.index < state.visibleFromIndex

      if (!needsToScroll) {
        return {
          ...state,
          value: previous.value,
        }
      }

      const nextVisibleFromIndex = previous.index
      const nextVisibleToIndex = nextVisibleFromIndex + state.visibleOptionCount - 1

      return {
        ...state,
        value: previous.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
        previousValue: state.value,
      }
    }

    case 'select-option': {
      const item = state.optionMap.get(action.option.value)

      if (!item) {
        return state
      }

      return {
        ...state,
        value: item.value,
        previousValue: state.value,
      }
    }

    case 'adjust-visible-window': {
      // The number of visible rows changed but the option set did NOT (e.g. a width-only resize that
      // crosses the description-panel breakpoint). Preserve the current highlight (`value`) and only
      // recompute the visible window so the highlighted item stays on screen, rather than resetting
      // to the first option (which could silently move the selection out from under the user).
      const total = state.optionMap.size
      const nextVisibleOptionCount = Math.min(action.visibleOptionCount, total)
      const currentIndex = typeof state.value === 'undefined' ? 0 : (state.optionMap.get(state.value)?.index ?? 0)

      const maxFromIndex = Math.max(0, total - nextVisibleOptionCount)
      let nextVisibleFromIndex = state.visibleFromIndex

      // Slide the window just far enough to keep the highlighted item inside it.
      if (currentIndex < nextVisibleFromIndex) {
        nextVisibleFromIndex = currentIndex
      } else if (currentIndex > nextVisibleFromIndex + nextVisibleOptionCount - 1) {
        nextVisibleFromIndex = currentIndex - nextVisibleOptionCount + 1
      }
      nextVisibleFromIndex = Math.max(0, Math.min(nextVisibleFromIndex, maxFromIndex))

      return {
        ...state,
        visibleOptionCount: nextVisibleOptionCount,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleFromIndex + nextVisibleOptionCount - 1,
      }
    }

    case 'reset': {
      return action.state
    }

    default: {
      return state
    }
  }
}

export interface UseSelectStateProps<T> {
  /**
   * Number of items to display.
   *
   */
  visibleOptionCount: number

  /**
   * Options.
   */
  options: Option<T>[]

  /**
   * Initially selected option's value.
   */
  defaultValue?: T
}

export type SelectState<T> = Pick<State<T>, 'visibleOptionCount' | 'visibleFromIndex' | 'visibleToIndex' | 'value'> & {
  /**
   * Visible options.
   */
  visibleOptions: (Option<T> & {index: number})[]

  /**
   * Select next option and scroll the list down, if needed.
   */
  selectNextOption: () => void

  /**
   * Select previous option and scroll the list up, if needed.
   */
  selectPreviousOption: () => void

  /**
   * Select option directly.
   */
  selectOption: (option: Option<T>) => void
}

type CreateDefaultStateProps<T> = Pick<UseSelectStateProps<T>, 'visibleOptionCount' | 'defaultValue' | 'options'>

const createDefaultState = <T>({
  visibleOptionCount: customVisibleOptionCount,
  defaultValue,
  options,
}: CreateDefaultStateProps<T>) => {
  const visibleOptionCount =
    typeof customVisibleOptionCount === 'number' ? Math.min(customVisibleOptionCount, options.length) : options.length
  const optionMap = new OptionMap(options)
  const defaultOption = typeof defaultValue === 'undefined' ? undefined : optionMap.get(defaultValue)
  let option = defaultOption && !defaultOption.disabled ? defaultOption : optionMap.first

  while (option && option.disabled) {
    option = option.next
  }

  return {
    optionMap,
    visibleOptionCount,
    visibleFromIndex: 0,
    visibleToIndex: visibleOptionCount - 1,
    value: option?.value,
    previousValue: option?.value,
  }
}

export const useSelectState = <T>({visibleOptionCount, options, defaultValue}: UseSelectStateProps<T>) => {
  const [state, dispatch] = useReducer(reducer, {visibleOptionCount, defaultValue, options}, createDefaultState)
  const [lastOptions, setLastOptions] = useState(options)
  const [lastVisibleOptionCount, setLastVisibleOptionCount] = useState(visibleOptionCount)

  if (options !== lastOptions && !isDeepStrictEqual(options, lastOptions)) {
    dispatch({
      type: 'reset',
      state: createDefaultState({visibleOptionCount, defaultValue, options}),
    })

    setLastOptions(options)
  }

  if (visibleOptionCount !== lastVisibleOptionCount) {
    // Only the visible-row count changed (the option set is unchanged — that case is handled by the
    // reset above). Keep the current highlight and just re-fit the visible window; do NOT reset to
    // the first option, or a width-only resize across the description-panel breakpoint would jump
    // the selection back to item 0.
    dispatch({
      type: 'adjust-visible-window',
      visibleOptionCount,
    })

    setLastVisibleOptionCount(visibleOptionCount)
  }

  const selectNextOption = useCallback(() => {
    dispatch({
      type: 'select-next-option',
    })
  }, [])

  const selectPreviousOption = useCallback(() => {
    dispatch({
      type: 'select-previous-option',
    })
  }, [])

  const selectOption = useCallback(({option}: {option: Option<T>}) => {
    dispatch({
      type: 'select-option',
      option,
    })
  }, [])

  const visibleOptions = useMemo(() => {
    return options.slice(state.visibleFromIndex)
  }, [options, state.visibleFromIndex])

  return {
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    value: state.value,
    visibleOptions,
    selectNextOption,
    selectPreviousOption,
    selectOption,
    previousValue: state.previousValue,
  }
}
