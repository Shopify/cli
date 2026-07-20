import {getMouseEnabled} from '../../conf-store.js'
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import {Box, DOMElement, useStdin, useStdout} from 'ink'
import {
  getBoundingClientRect,
  getElementDimensions,
  MouseProvider as InkMouseProvider,
  useOnClick as useInkOnClick,
  useOnMouseEnter as useInkOnMouseEnter,
  type ClickHandler,
  type ElementRef,
  type MouseEnterHandler,
} from '@ink-tools/ink-mouse'

const CURSOR_POSITION_REQUEST = '\u001B[6n'
// Ink removes the leading escape character before passing terminal input to useInput.
const CURSOR_POSITION_RESPONSE_PREFIX = '['
const MOUSE_ORIGIN_QUERY_TIMEOUT_MS = 100
const MOUSE_LAYOUT_POLL_INTERVAL_MS = 50
const MOUSE_SCROLL_RELEASE_MS = 1500
// Mouse tracking modes are mutually exclusive in terminal emulators. After disabling
// movement modes, explicitly restore basic press/release reporting for clickable tabs.
const ENABLE_CLICK_ONLY_MOUSE = '\u001B[?1003l\u001B[?1002l\u001B[?1000h'
const DISABLE_MOUSE_REPORTING = '\u001B[?1003l\u001B[?1002l\u001B[?1000l'
const SGR_MOUSE_EVENT_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[<(\\d+);\\d+;\\d+[Mm]`, 'gu')
const MouseOriginContext = createContext(0)

interface MouseProviderProps extends React.PropsWithChildren {
  allowTerminalScrolling?: boolean
  trackMouseMovement?: boolean
}

function getMouseTrackingMode(trackMouseMovement: boolean): string | undefined {
  if (trackMouseMovement) return undefined
  return ENABLE_CLICK_ONLY_MOUSE
}

function containsMouseWheelEvent(data: Buffer | string): boolean {
  return [...data.toString().matchAll(SGR_MOUSE_EVENT_PATTERN)].some((match) => {
    const buttonCode = Number(match[1])
    return buttonCode >= 64 && buttonCode < 128
  })
}

function parseCursorPosition(data: Buffer | string): {row: number; column: number} | undefined {
  const response = data.toString()
  const responseStart = response.indexOf(CURSOR_POSITION_RESPONSE_PREFIX)
  const responseEnd = response.indexOf('R', responseStart)
  if (responseStart === -1 || responseEnd === -1) return undefined

  const [row, column] = response.slice(responseStart + CURSOR_POSITION_RESPONSE_PREFIX.length, responseEnd).split(';')
  const parsedRow = Number(row)
  const parsedColumn = Number(column)
  if (!Number.isInteger(parsedRow) || !Number.isInteger(parsedColumn)) return undefined

  return {row: parsedRow, column: parsedColumn}
}

function removeSgrMouseResponses(input: string): string {
  let sanitizedInput = input
  let responseStart = sanitizedInput.indexOf('[<')

  while (responseStart !== -1) {
    const pressEnd = sanitizedInput.indexOf('M', responseStart)
    const releaseEnd = sanitizedInput.indexOf('m', responseStart)
    const responseEnd = [pressEnd, releaseEnd].filter((index) => index !== -1).sort((left, right) => left - right)[0]
    if (responseEnd === undefined) break

    const fields = sanitizedInput.slice(responseStart + 2, responseEnd).split(';')
    const isMouseResponse =
      fields.length === 3 && fields.every((field) => field.length > 0 && Number.isInteger(Number(field)))
    if (!isMouseResponse) {
      responseStart = sanitizedInput.indexOf('[<', responseStart + 1)
      continue
    }

    sanitizedInput = sanitizedInput.slice(0, responseStart) + sanitizedInput.slice(responseEnd + 1)
    responseStart = sanitizedInput.indexOf('[<', responseStart)
  }

  return sanitizedInput
}

export function removeTerminalInputResponses(input: string): string {
  let sanitizedInput = input
  let responseStart = sanitizedInput.indexOf(CURSOR_POSITION_RESPONSE_PREFIX)

  while (responseStart !== -1) {
    const responseEnd = sanitizedInput.indexOf('R', responseStart)
    if (responseEnd === -1) break

    const response = sanitizedInput.slice(responseStart, responseEnd + 1)
    if (!parseCursorPosition(response)) {
      responseStart = sanitizedInput.indexOf(CURSOR_POSITION_RESPONSE_PREFIX, responseStart + 1)
      continue
    }

    sanitizedInput = sanitizedInput.slice(0, responseStart) + sanitizedInput.slice(responseEnd + 1)
    responseStart = sanitizedInput.indexOf(CURSOR_POSITION_RESPONSE_PREFIX, responseStart)
  }

  return removeSgrMouseResponses(sanitizedInput)
}

export function MouseProvider({children, ...mouseProviderProps}: MouseProviderProps): React.ReactElement {
  if (getMouseEnabled()) {
    return <EnabledMouseProvider {...mouseProviderProps}>{children}</EnabledMouseProvider>
  }

  return (
    <InkMouseProvider autoEnable={false}>
      <Box flexDirection="column">{children}</Box>
    </InkMouseProvider>
  )
}

function EnabledMouseProvider({
  allowTerminalScrolling = false,
  children,
  trackMouseMovement = true,
}: MouseProviderProps): React.ReactElement {
  const rootRef = useRef<DOMElement>(null)
  const {stdin} = useStdin()
  const {stdout} = useStdout()
  const [verticalOffset, setVerticalOffset] = useState(0)
  const [rootHeight, setRootHeight] = useState<number>()
  const scrollReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const mouseTrackingMode = getMouseTrackingMode(trackMouseMovement)

  useEffect(() => {
    const measureRoot = () => {
      const measuredHeight = getElementDimensions(rootRef.current)?.height
      setRootHeight((currentHeight) => (currentHeight === measuredHeight ? currentHeight : measuredHeight))
    }

    measureRoot()
    const interval = setInterval(measureRoot, MOUSE_LAYOUT_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!stdin.isTTY || !stdout.isTTY || rootHeight === undefined) return

    const stopListening = () => {
      clearTimeout(timeout)
      stdin.off('data', handleCursorPosition)
    }
    const handleCursorPosition = (data: Buffer | string) => {
      const cursorPosition = parseCursorPosition(data)
      const rootDimensions = getElementDimensions(rootRef.current)
      if (!cursorPosition || !rootDimensions) return

      const trailingLineOffset = cursorPosition.column === 1 ? 1 : 0
      setVerticalOffset(Math.max(0, cursorPosition.row - rootDimensions.height - trailingLineOffset))
      stopListening()
    }

    stdin.on('data', handleCursorPosition)
    const timeout = setTimeout(stopListening, MOUSE_ORIGIN_QUERY_TIMEOUT_MS)
    stdout.write(CURSOR_POSITION_REQUEST)

    return stopListening
  }, [rootHeight, stdin, stdout])

  useEffect(() => {
    if (mouseTrackingMode && stdout.isTTY) stdout.write(mouseTrackingMode)
  }, [mouseTrackingMode, stdout])

  const releaseMouseForTerminalScrolling = useCallback(() => {
    if (!mouseTrackingMode || !stdout.isTTY) return

    stdout.write(DISABLE_MOUSE_REPORTING)
    clearTimeout(scrollReleaseTimeoutRef.current)
    scrollReleaseTimeoutRef.current = setTimeout(() => {
      stdout.write(mouseTrackingMode)
    }, MOUSE_SCROLL_RELEASE_MS)
  }, [mouseTrackingMode, stdout])

  useEffect(() => {
    return () => clearTimeout(scrollReleaseTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!allowTerminalScrolling || !mouseTrackingMode || !stdin.isTTY) return

    const handleTerminalInput = (data: Buffer | string) => {
      if (containsMouseWheelEvent(data)) releaseMouseForTerminalScrolling()
    }

    // Listen to stdin directly so scrolling is detected even when the pointer is
    // outside the rendered Ink tree, including blank areas of the terminal viewport.
    stdin.on('data', handleTerminalInput)
    return () => {
      stdin.off('data', handleTerminalInput)
    }
  }, [allowTerminalScrolling, mouseTrackingMode, releaseMouseForTerminalScrolling, stdin])

  return (
    <InkMouseProvider>
      <MouseOriginContext.Provider value={verticalOffset}>
        <Box ref={rootRef} flexDirection="column">
          {children}
        </Box>
      </MouseOriginContext.Provider>
    </InkMouseProvider>
  )
}

export function useOnClick(ref: ElementRef, handler: ClickHandler | null | undefined): void {
  const offsetRef = useOffsetRef(ref)
  useInkOnClick(offsetRef, handler)
}

export function useOnMouseEnter(ref: ElementRef, handler: MouseEnterHandler | null | undefined): void {
  const offsetRef = useOffsetRef(ref)
  useInkOnMouseEnter(offsetRef, handler)
}

function useOffsetRef(ref: ElementRef): ElementRef {
  const verticalOffset = useContext(MouseOriginContext)
  return useMemo<ElementRef>(() => {
    return {
      get current() {
        const element = ref.current as DOMElement | null
        const bounds = getBoundingClientRect(element)
        if (!bounds) return null

        return {
          yogaNode: {
            getComputedLayout: () => ({
              left: bounds.left - 1,
              top: bounds.top - 1 + verticalOffset,
              // ink-mouse treats right and bottom edges as inclusive. Yoga dimensions
              // are counts, so subtract one to prevent adjacent terminal cells from overlapping.
              width: Math.max(0, bounds.width - 1),
              height: Math.max(0, bounds.height - 1),
            }),
          },
          parentNode: null,
        }
      },
    }
  }, [ref, verticalOffset])
}
