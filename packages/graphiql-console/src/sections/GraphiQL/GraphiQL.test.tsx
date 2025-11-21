import {GraphiQLSection} from './GraphiQL.tsx'
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {AppProvider} from '@shopify/polaris'
import type {ServerStatus} from '@/hooks/useServerStatus'

// Mock the hooks
const mockUseServerStatus = vi.fn()
vi.mock('@/hooks/useServerStatus', () => ({
  useServerStatus: (options: any) => mockUseServerStatus(options),
}))

// Mock child components
vi.mock('@/components/StatusBadge/StatusBadge.tsx', () => ({
  StatusBadge: ({status}: {status: ServerStatus}) => <div data-testid="status-badge">{JSON.stringify(status)}</div>,
}))

vi.mock('@/components/ErrorBanner/ErrorBanner.tsx', () => ({
  ErrorBanner: ({isVisible}: {isVisible: boolean}) => (
    <div data-testid="error-banner" data-visible={isVisible}>
      ErrorBanner
    </div>
  ),
}))

vi.mock('@/components/LinkPills/LinkPills.tsx', () => ({
  LinkPills: ({status}: {status: ServerStatus}) => <div data-testid="link-pills">{JSON.stringify(status)}</div>,
}))

vi.mock('@/components/ApiVersionSelector/ApiVersionSelector.tsx', () => ({
  ApiVersionSelector: ({
    versions,
    value,
    onChange,
  }: {
    versions: string[]
    value: string
    onChange: (version: string) => void
  }) => (
    <div data-testid="api-version-selector" data-versions={versions.join(',')} data-value={value}>
      <button onClick={() => onChange('new-version')}>Change Version</button>
    </div>
  ),
}))

vi.mock('@/components/GraphiQLEditor/GraphiQLEditor.tsx', () => ({
  GraphiQLEditor: ({config, apiVersion}: {config: any; apiVersion: string}) => (
    <div data-testid="graphiql-editor" data-api-version={apiVersion}>
      {JSON.stringify(config)}
    </div>
  ),
}))

// Helper to wrap components in AppProvider
function renderWithProvider(element: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{element}</AppProvider>)
}

describe('<GraphiQLSection />', () => {
  beforeEach(() => {
    // Reset mocks before each test

    // Default mock implementation
    mockUseServerStatus.mockReturnValue({
      serverIsLive: true,
      appIsInstalled: true,
      storeFqdn: 'test-store.myshopify.com',
      appName: 'Test App',
      appUrl: 'http://localhost:3000',
    })

    // Mock window.__GRAPHIQL_CONFIG__
    ;(window as any).__GRAPHIQL_CONFIG__ = undefined
  })

  test('renders all child components', () => {
    renderWithProvider(<GraphiQLSection />)

    expect(screen.getByTestId('status-badge')).toBeDefined()
    expect(screen.getByTestId('link-pills')).toBeDefined()
    expect(screen.getByTestId('api-version-selector')).toBeDefined()
    expect(screen.getByTestId('graphiql-editor')).toBeDefined()
  })

  test('ErrorBanner visible when serverIsLive=false', () => {
    mockUseServerStatus.mockReturnValue({
      serverIsLive: false,
      appIsInstalled: true,
    })

    renderWithProvider(<GraphiQLSection />)
    const errorBanner = screen.getByTestId('error-banner')

    expect(errorBanner).toBeDefined()
    expect(errorBanner.getAttribute('data-visible')).toBe('true')
  })

  test('ErrorBanner not rendered when serverIsLive=true', () => {
    mockUseServerStatus.mockReturnValue({
      serverIsLive: true,
      appIsInstalled: true,
    })

    renderWithProvider(<GraphiQLSection />)

    // ErrorBanner should not be in DOM when server is live
    expect(screen.queryByTestId('error-banner')).toBeNull()
  })

  test('passes correct props to StatusBadge', () => {
    const mockStatus: ServerStatus = {
      serverIsLive: true,
      appIsInstalled: true,
      storeFqdn: 'test-store.myshopify.com',
      appName: 'Test App',
      appUrl: 'http://localhost:3000',
    }
    mockUseServerStatus.mockReturnValue(mockStatus)

    renderWithProvider(<GraphiQLSection />)
    const statusBadge = screen.getByTestId('status-badge')

    expect(statusBadge).toBeDefined()
    expect(statusBadge.textContent).toContain('"serverIsLive":true')
    expect(statusBadge.textContent).toContain('"appIsInstalled":true')
  })

  test('passes correct props to LinkPills', () => {
    const mockStatus: ServerStatus = {
      serverIsLive: true,
      appIsInstalled: true,
      storeFqdn: 'test-store.myshopify.com',
      appName: 'Test App',
      appUrl: 'http://localhost:3000',
    }
    mockUseServerStatus.mockReturnValue(mockStatus)

    renderWithProvider(<GraphiQLSection />)
    const linkPills = screen.getByTestId('link-pills')

    expect(linkPills).toBeDefined()
    expect(linkPills.textContent).toContain('test-store.myshopify.com')
  })

  test('getConfig() reads window.__GRAPHIQL_CONFIG__', () => {
    const customConfig = {
      baseUrl: 'http://localhost:4000',
      apiVersion: '2023-01',
      apiVersions: ['2023-01'],
      appName: 'Custom App',
      appUrl: 'http://localhost:3000',
      storeFqdn: 'custom.myshopify.com',
    }

    ;(window as any).__GRAPHIQL_CONFIG__ = customConfig

    renderWithProvider(<GraphiQLSection />)
    const editor = screen.getByTestId('graphiql-editor')

    expect(editor).toBeDefined()
    const editorConfig = JSON.parse(editor.textContent ?? '{}')
    expect(editorConfig.baseUrl).toBe('http://localhost:4000')
    expect(editorConfig.appName).toBe('Custom App')

    // Cleanup
    ;(window as any).__GRAPHIQL_CONFIG__ = undefined
  })

  test('getConfig() falls back to defaults in development', () => {
    // Ensure no global config
    ;(window as any).__GRAPHIQL_CONFIG__ = undefined

    renderWithProvider(<GraphiQLSection />)
    const editor = screen.getByTestId('graphiql-editor')

    expect(editor).toBeDefined()
    const editorConfig = JSON.parse(editor.textContent ?? '{}')

    // Should have default values
    expect(editorConfig.apiVersion).toBe('2024-10')
    expect(editorConfig.apiVersions).toEqual(['2024-01', '2024-04', '2024-07', '2024-10', 'unstable'])
  })

  test('ApiVersionSelector receives correct versions and value', () => {
    renderWithProvider(<GraphiQLSection />)
    const selector = screen.getByTestId('api-version-selector')

    expect(selector).toBeDefined()
    expect(selector.getAttribute('data-versions')).toBe('2024-01,2024-04,2024-07,2024-10,unstable')
    expect(selector.getAttribute('data-value')).toBe('2024-10')
  })

  test('calls useServerStatus with correct baseUrl', () => {
    renderWithProvider(<GraphiQLSection />)

    expect(mockUseServerStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: expect.any(String),
      }),
    )
  })

  test('version selection updates GraphiQL editor', () => {
    renderWithProvider(<GraphiQLSection />)

    // Initial state
    let editor = screen.getByTestId('graphiql-editor')
    expect(editor.getAttribute('data-api-version')).toBe('2024-10')

    // Trigger version change
    const button = screen.getByText('Change Version')
    fireEvent.click(button)

    // Re-find after state update
    editor = screen.getByTestId('graphiql-editor')
    expect(editor.getAttribute('data-api-version')).toBe('new-version')
  })
})
