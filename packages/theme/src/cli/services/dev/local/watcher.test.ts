import {watchThemeFiles} from './watcher.js'
import {ChangeEvent, LocalDevServerContext, ThemeRenderer} from './types.js'
import {describe, expect, test, vi} from 'vitest'
import type {ThemeFileSystem, ThemeFSEventName, ThemeFSEventPayload} from '@shopify/cli-kit/node/themes/types'

/* A theme file system stub that lets the test fire add/change/unlink events. */
function controllableFileSystem() {
  const listeners: Partial<Record<ThemeFSEventName, (payload: ThemeFSEventPayload<ThemeFSEventName>) => void>> = {}

  const fileSystem = {
    addEventListener: vi.fn((eventName: ThemeFSEventName, cb: (payload: never) => void) => {
      listeners[eventName] = cb as (payload: ThemeFSEventPayload<ThemeFSEventName>) => void
    }),
  } as unknown as ThemeFileSystem

  const emit = (eventName: ThemeFSEventName, fileKey: string) => {
    listeners[eventName]?.({fileKey} as ThemeFSEventPayload<ThemeFSEventName>)
  }

  return {fileSystem, emit}
}

function buildContext(fileSystem: ThemeFileSystem): LocalDevServerContext {
  const renderer: ThemeRenderer = {render: vi.fn(async () => ({body: 'x', status: 200, headers: {}}))}
  return {
    directory: 'tmp',
    host: '127.0.0.1',
    port: 9292,
    liveReload: 'local-hot-reload',
    localThemeFileSystem: fileSystem,
    lastRequestedPath: '',
    renderer,
  }
}

describe('watchThemeFiles', () => {
  test('forwards a normalized change event after the debounce window', () => {
    // Given
    vi.useFakeTimers()
    const {fileSystem, emit} = controllableFileSystem()
    const onChange = vi.fn<(event: ChangeEvent) => void>()
    watchThemeFiles(buildContext(fileSystem), onChange, {debounceMs: 50})

    // When
    emit('change', 'sections/header.liquid')
    vi.advanceTimersByTime(60)

    // Then
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({type: 'change', path: 'sections/header.liquid'})
    vi.useRealTimers()
  })

  test('debounces a burst of events into a single call', () => {
    // Given
    vi.useFakeTimers()
    const {fileSystem, emit} = controllableFileSystem()
    const onChange = vi.fn<(event: ChangeEvent) => void>()
    watchThemeFiles(buildContext(fileSystem), onChange, {debounceMs: 50})

    // When
    emit('add', 'a.liquid')
    emit('change', 'b.liquid')
    emit('unlink', 'c.liquid')
    vi.advanceTimersByTime(60)

    // Then
    expect(onChange).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  test('close() cancels a pending reload', async () => {
    // Given
    vi.useFakeTimers()
    const {fileSystem, emit} = controllableFileSystem()
    const onChange = vi.fn<(event: ChangeEvent) => void>()
    const watcher = watchThemeFiles(buildContext(fileSystem), onChange, {debounceMs: 50})

    // When
    emit('change', 'a.liquid')
    await watcher.close()
    vi.advanceTimersByTime(60)

    // Then
    expect(onChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
