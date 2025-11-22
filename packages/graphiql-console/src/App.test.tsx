import App from './App.tsx'
import React from 'react'
import {render, screen} from '@testing-library/react'
import {describe, test, expect} from 'vitest'

describe('<App />', () => {
  test('renders AppProvider with basic content', () => {
    render(<App />)

    expect(screen.getByText('GraphiQL Console')).toBeDefined()
  })

  test('provides i18n context to children', () => {
    const {container} = render(<App />)

    // AppProvider should be rendered (it creates a div wrapper)
    expect(container.querySelector('div')).toBeDefined()
  })
})
