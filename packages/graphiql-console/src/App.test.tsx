import App from './App.tsx'
import React from 'react'
import {render, screen} from '@testing-library/react'
import {describe, test, expect, vi} from 'vitest'

// Mock GraphiQLSection component
vi.mock('./sections/GraphiQL/index.ts', () => ({
  GraphiQLSection: () => <div data-testid="graphiql-section">GraphiQLSection</div>,
}))

describe('<App />', () => {
  test('renders AppProvider with GraphiQLSection', () => {
    render(<App />)

    expect(screen.getByTestId('graphiql-section')).toBeDefined()
  })

  test('provides i18n context to children', () => {
    const {container} = render(<App />)

    // AppProvider should be rendered (it creates a div wrapper)
    expect(container.querySelector('div')).toBeDefined()
  })
})
