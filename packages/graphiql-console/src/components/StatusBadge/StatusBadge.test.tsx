import {StatusBadge} from './StatusBadge.tsx'
import React from 'react'
import {render, screen} from '@testing-library/react'
import {describe, test, expect} from 'vitest'
import {AppProvider} from '@shopify/polaris'
import type {ServerStatus} from '../types'

// Helper to wrap components in AppProvider
function renderWithProvider(element: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{element}</AppProvider>)
}

describe('<StatusBadge />', () => {
  test('renders critical "Disconnected" badge when server is down', () => {
    const status: ServerStatus = {
      serverIsLive: false,
      appIsInstalled: true,
    }
    renderWithProvider(<StatusBadge status={status} />)

    expect(screen.getByText('Disconnected')).toBeDefined()
  })

  test('renders attention "App uninstalled" badge when app is not installed', () => {
    const status: ServerStatus = {
      serverIsLive: true,
      appIsInstalled: false,
    }
    renderWithProvider(<StatusBadge status={status} />)

    expect(screen.getByText('App uninstalled')).toBeDefined()
  })

  test('renders success "Running" badge when both server and app are healthy', () => {
    const status: ServerStatus = {
      serverIsLive: true,
      appIsInstalled: true,
      storeFqdn: 'test-store.myshopify.com',
      appName: 'Test App',
      appUrl: 'http://localhost:3000',
    }
    renderWithProvider(<StatusBadge status={status} />)

    expect(screen.getByText('Running')).toBeDefined()
  })

  test('prioritizes disconnected over uninstalled status', () => {
    const status: ServerStatus = {
      serverIsLive: false,
      appIsInstalled: false,
    }
    renderWithProvider(<StatusBadge status={status} />)

    // Should show disconnected (critical) rather than uninstalled (attention)
    expect(screen.getByText('Disconnected')).toBeDefined()
    expect(screen.queryByText('App uninstalled')).toBeNull()
  })
})
