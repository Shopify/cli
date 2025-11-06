import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

// Mock dependencies
vi.mock('react-dom/client', () => {
  const mockRender = vi.fn()
  const mockCreateRoot = vi.fn(() => ({
    render: mockRender,
  }))
  return {
    createRoot: mockCreateRoot,
  }
})

vi.mock('./App.tsx', () => ({
  default: () => null,
}))

describe('main.tsx', () => {
  let originalGetElementById: typeof document.getElementById

  beforeEach(() => {
    // Save original method
    originalGetElementById = document.getElementById

    // Clear module cache to ensure fresh import
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original method
    document.getElementById = originalGetElementById
  })

  test('finds root element and renders App', async () => {
    const mockRootElement = document.createElement('div')
    mockRootElement.id = 'root'

    document.getElementById = vi.fn().mockReturnValue(mockRootElement)

    // Import main to execute it
    const {createRoot} = await import('react-dom/client')

    // Dynamic import to trigger execution
    await import('./main.tsx')

    expect(document.getElementById).toHaveBeenCalledWith('root')
    expect(createRoot).toHaveBeenCalledWith(mockRootElement)
  })

  test('throws error when root element not found', async () => {
    document.getElementById = vi.fn().mockReturnValue(null)

    // Expect the import to throw
    await expect(async () => {
      await import('./main.tsx')
    }).rejects.toThrow('Root element not found')
  })
})
