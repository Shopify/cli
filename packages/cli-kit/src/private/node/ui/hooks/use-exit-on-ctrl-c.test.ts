import {useExitOnCtrlC} from './use-exit-on-ctrl-c.js'
import {handleCtrlC} from '../../ui.js'
import {describe, expect, test, vi} from 'vitest'
import {useInput, useStdin} from 'ink'

vi.mock('ink', () => ({
  useInput: vi.fn(),
  useStdin: vi.fn(),
}))

vi.mock('../../ui.js', () => ({
  handleCtrlC: vi.fn(),
}))

// Helper function to render the hook without JSX
function renderHook(hookFn: () => void) {
  hookFn()
}

describe('useExitOnCtrlC', () => {
  test('registers input handler when raw mode is supported', () => {
    // Given
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: true,
    } as any)
    vi.mocked(useInput).mockImplementation(() => {})

    // When
    renderHook(() => useExitOnCtrlC())

    // Then
    expect(useInput).toHaveBeenCalledWith(expect.any(Function), {isActive: true})
  })

  test('does not register input handler when raw mode is not supported', () => {
    // Given
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: false,
    } as any)
    vi.mocked(useInput).mockImplementation(() => {})

    // When
    renderHook(() => useExitOnCtrlC())

    // Then
    expect(useInput).toHaveBeenCalledWith(expect.any(Function), {isActive: false})
  })

  test('does not register input handler when raw mode support is undefined', () => {
    // Given
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: undefined,
    } as any)
    vi.mocked(useInput).mockImplementation(() => {})

    // When
    renderHook(() => useExitOnCtrlC())

    // Then
    expect(useInput).toHaveBeenCalledWith(expect.any(Function), {isActive: false})
  })

  test('calls handleCtrlC when input is received', () => {
    // Given
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: true,
    } as any)

    let inputHandler: ((input: string, key: any) => void) | undefined
    vi.mocked(useInput).mockImplementation((handler) => {
      inputHandler = handler
    })

    // When
    renderHook(() => useExitOnCtrlC())

    // Simulate ctrl+c input
    const mockKey = {ctrl: true}
    inputHandler?.('c', mockKey)

    // Then
    expect(handleCtrlC).toHaveBeenCalledWith('c', mockKey)
  })

  test('calls handleCtrlC with different input', () => {
    // Given
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: true,
    } as any)

    let inputHandler: ((input: string, key: any) => void) | undefined
    vi.mocked(useInput).mockImplementation((handler) => {
      inputHandler = handler
    })

    // When
    renderHook(() => useExitOnCtrlC())

    // Simulate different input
    const mockKey = {ctrl: false}
    inputHandler?.('a', mockKey)

    // Then
    expect(handleCtrlC).toHaveBeenCalledWith('a', mockKey)
  })

  test('input handler is only active when raw mode is supported', () => {
    // Test with raw mode supported
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: true,
    } as any)

    renderHook(() => useExitOnCtrlC())

    expect(useInput).toHaveBeenLastCalledWith(expect.any(Function), {isActive: true})

    // Test with raw mode not supported
    vi.mocked(useStdin).mockReturnValue({
      isRawModeSupported: false,
    } as any)

    renderHook(() => useExitOnCtrlC())

    expect(useInput).toHaveBeenLastCalledWith(expect.any(Function), {isActive: false})
  })
})
