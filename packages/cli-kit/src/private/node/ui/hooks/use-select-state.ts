import {ItemWithKey, OnChangeOptions} from '../components/SelectInput.js'
import {useReducer, useCallback, useMemo, useState, useEffect} from 'react'
import {isDeepStrictEqual} from 'node:util'

type Option<T> = ItemWithKey<T>

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

      if (!firstItem) {
        firstItem = item
      }

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
   * Value of the currently focused option.
   */
  focusedValue: T | undefined

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

type Action<T> = FocusNextOptionAction | FocusPreviousOptionAction | SelectFocusedOptionAction | ResetAction<T>

interface FocusNextOptionAction {
  type: 'focus-next-option'
}

interface FocusPreviousOptionAction {
  type: 'focus-previous-option'
}

interface SelectFocusedOptionAction {
  type: 'select-focused-option'
}

interface ResetAction<T> {
  type: 'reset'
  state: State<T>
}

const reducer = <T>(state: State<T>, action: Action<T>): State<T> => {
  switch (action.type) {
    case 'focus-next-option': {
      if (!state.focusedValue) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      const next = item.next

      if (!next) {
        return state
      }

      const needsToScroll = next.index >= state.visibleToIndex

      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: next.value,
        }
      }

      const nextVisibleToIndex = Math.min(state.optionMap.size, state.visibleToIndex + 1)

      const nextVisibleFromIndex = nextVisibleToIndex - state.visibleOptionCount

      return {
        ...state,
        focusedValue: next.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'focus-previous-option': {
      if (!state.focusedValue) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      const previous = item.previous

      if (!previous) {
        return state
      }

      const needsToScroll = previous.index <= state.visibleFromIndex

      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: previous.value,
        }
      }

      const nextVisibleFromIndex = Math.max(0, state.visibleFromIndex - 1)

      const nextVisibleToIndex = nextVisibleFromIndex + state.visibleOptionCount

      return {
        ...state,
        focusedValue: previous.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'select-focused-option': {
      return {
        ...state,
        previousValue: state.value,
        value: state.focusedValue,
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
  visibleOptionCount?: number

  /**
   * Options.
   */
  options: Option<T>[]

  /**
   * Initially selected option's value.
   */
  defaultValue?: T

  /**
   * Callback for selecting an option.
   */
  onChange: ({item, usedShortcut}: OnChangeOptions<T>) => void
}

export type SelectState<T> = Pick<State<T>, 'focusedValue' | 'visibleFromIndex' | 'visibleToIndex' | 'value'> & {
  /**
   * Visible options.
   */
  visibleOptions: (Option<T> & {index: number})[]

  /**
   * Focus next option and scroll the list down, if needed.
   */
  focusNextOption: () => void

  /**
   * Focus previous option and scroll the list up, if needed.
   */
  focusPreviousOption: () => void

  /**
   * Select currently focused option.
   */
  selectFocusedOption: () => void
}

const createDefaultState = <T>({
  visibleOptionCount: customVisibleOptionCount,
  defaultValue,
  options,
}: Pick<UseSelectStateProps<T>, 'visibleOptionCount' | 'defaultValue' | 'options'>) => {
  const visibleOptionCount =
    typeof customVisibleOptionCount === 'number' ? Math.min(customVisibleOptionCount, options.length) : options.length

  const optionMap = new OptionMap(options)

  return {
    optionMap,
    visibleOptionCount,
    focusedValue: optionMap.first?.value,
    visibleFromIndex: 0,
    visibleToIndex: visibleOptionCount,
    previousValue: defaultValue,
    value: defaultValue,
  }
}

export const useSelectState = <T>({
  visibleOptionCount = 5,
  options,
  defaultValue,
  onChange,
}: UseSelectStateProps<T>) => {
  const [state, dispatch] = useReducer(reducer, {visibleOptionCount, defaultValue, options}, createDefaultState)

  const [lastOptions, setLastOptions] = useState(options)

  if (options !== lastOptions && !isDeepStrictEqual(options, lastOptions)) {
    dispatch({
      type: 'reset',
      state: createDefaultState({visibleOptionCount, defaultValue, options}),
    })

    setLastOptions(options)
  }

  const focusNextOption = useCallback(() => {
    dispatch({
      type: 'focus-next-option',
    })
  }, [])

  const focusPreviousOption = useCallback(() => {
    dispatch({
      type: 'focus-previous-option',
    })
  }, [])

  const selectFocusedOption = useCallback(() => {
    dispatch({
      type: 'select-focused-option',
    })
  }, [])

  const visibleOptions = useMemo(() => {
    return options
      .map((option, index) => ({
        ...option,
        index,
      }))
      .slice(state.visibleFromIndex, state.visibleToIndex)
  }, [options, state.visibleFromIndex, state.visibleToIndex])

  useEffect(() => {
    if (options.length === 0) {
      onChange({item: undefined, usedShortcut: false})
    } else if (state.value && state.previousValue !== state.value) {
      onChange({item: state.value, usedShortcut: false})
    }
  }, [state.previousValue, state.value, options, onChange])

  return {
    focusedValue: state.focusedValue,
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    value: state.value,
    visibleOptions,
    focusNextOption,
    focusPreviousOption,
    selectFocusedOption,
  }
}
