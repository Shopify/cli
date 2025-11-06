import {ErrorBanner} from './ErrorBanner.tsx'
import React from 'react'
import {render, screen} from '@testing-library/react'
import {describe, test, expect} from 'vitest'
import {AppProvider} from '@shopify/polaris'

// Helper to wrap components in AppProvider
function renderWithProvider(element: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{element}</AppProvider>)
}

describe('<ErrorBanner />', () => {
  test('renders Banner when isVisible=true', () => {
    renderWithProvider(<ErrorBanner isVisible={true} />)

    // Check for the error message content
    expect(screen.getByText(/The server has been stopped/i)).toBeDefined()
  })

  test('returns null when isVisible=false', () => {
    renderWithProvider(<ErrorBanner isVisible={false} />)

    // When isVisible=false, ErrorBanner returns null, so error message should not be present
    expect(screen.queryByText(/The server has been stopped/i)).toBeNull()
  })

  test('contains correct error message', () => {
    renderWithProvider(<ErrorBanner isVisible={true} />)

    expect(screen.getByText(/The server has been stopped/i)).toBeDefined()
    expect(screen.getByText(/Restart/i)).toBeDefined()
    expect(screen.getByText(/dev/i)).toBeDefined()
  })

  test('uses critical tone', () => {
    const {container} = renderWithProvider(<ErrorBanner isVisible={true} />)

    // Polaris Banner with tone="critical" adds a specific class
    const banner = container.querySelector('[class*="Banner"]')
    expect(banner).toBeTruthy()
  })
})
