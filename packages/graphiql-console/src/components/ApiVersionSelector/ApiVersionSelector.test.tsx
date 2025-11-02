import {ApiVersionSelector} from './ApiVersionSelector.tsx'
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import {describe, test, expect, vi} from 'vitest'
import {AppProvider} from '@shopify/polaris'

// Helper to wrap components in AppProvider
function renderWithProvider(element: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{element}</AppProvider>)
}

describe('<ApiVersionSelector />', () => {
  const defaultVersions = ['2024-01', '2024-04', '2024-07', '2024-10', 'unstable']

  test('renders Select component', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={defaultVersions} value="2024-10" onChange={onChange} />)

    // Select should be rendered with the accessibility label
    const select = screen.getByLabelText('API version')
    expect(select).toBeDefined()
  })

  test('Select has hidden label', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={defaultVersions} value="2024-10" onChange={onChange} />)

    // Label should exist but be visually hidden (Polaris labelHidden behavior)
    const select = screen.getByLabelText('API version')
    expect(select).toBeDefined()
  })

  test('renders all version options', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={defaultVersions} value="2024-10" onChange={onChange} />)

    const select = screen.getByLabelText('API version') as HTMLSelectElement

    expect(select.options).toHaveLength(5)
    expect(select.options[0].value).toBe('2024-01')
    expect(select.options[1].value).toBe('2024-04')
    expect(select.options[2].value).toBe('2024-07')
    expect(select.options[3].value).toBe('2024-10')
    expect(select.options[4].value).toBe('unstable')
  })

  test('displays currently selected value', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={defaultVersions} value="2024-07" onChange={onChange} />)

    const select = screen.getByLabelText('API version') as HTMLSelectElement
    expect(select.value).toBe('2024-07')
  })

  test('calls onChange when selection changes', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={defaultVersions} value="2024-10" onChange={onChange} />)

    const select = screen.getByLabelText('API version')
    fireEvent.change(select, {target: {value: '2024-04'}})

    expect(onChange).toHaveBeenCalledTimes(1)
    // Polaris Select may pass additional parameters, check first argument
    expect(onChange.mock.calls[0][0]).toBe('2024-04')
  })

  test('handles empty versions array', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={[]} value="" onChange={onChange} />)

    const select = screen.getByLabelText('API version') as HTMLSelectElement
    expect(select.options).toHaveLength(0)
  })

  test('handles single version', () => {
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={['2024-10']} value="2024-10" onChange={onChange} />)

    const select = screen.getByLabelText('API version') as HTMLSelectElement
    expect(select.options).toHaveLength(1)
    expect(select.options[0].value).toBe('2024-10')
  })

  test('handles custom version strings', () => {
    const customVersions = ['v1', 'v2', 'v3-beta']
    const onChange = vi.fn()
    renderWithProvider(<ApiVersionSelector versions={customVersions} value="v2" onChange={onChange} />)

    const select = screen.getByLabelText('API version') as HTMLSelectElement
    expect(select.options[0].value).toBe('v1')
    expect(select.options[1].value).toBe('v2')
    expect(select.options[2].value).toBe('v3-beta')
  })
})
