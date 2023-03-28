import {Tooltip} from '../Tooltip'
import React from 'react'
import {mount} from '@shopify/react-testing'
import {vi, test} from 'vitest'

const handleClick = vi.fn()

const TextChildComponent = () => <Tooltip text="test">test</Tooltip>
const ComponentChildComponent = () => (
  <Tooltip text="test">
    <button onClick={handleClick} id="btn">
      Button
    </button>
  </Tooltip>
)

describe('<Tooltip />', () => {
  test.each([
    ['onMouseEnter', 'onMouseLeave'],
    ['onFocus', 'onBlur'],
  ])('appears if hovered/focused/etc, hidden otherwise', (showEvent: any, hideEvent: any) => {
    const wrapper = mount(<TextChildComponent />)

    wrapper.act(() => {
      wrapper.find('div')?.trigger(showEvent)
    })

    let tooltip = wrapper.find('div', {role: 'tooltip'})

    expect(tooltip).not.toBeNull()

    wrapper.act(() => {
      wrapper.find('div')?.trigger(hideEvent)
    })

    tooltip = wrapper.find('div', {role: 'tooltip'})

    expect(tooltip).toBeNull()
  })

  test('hitting enter triggers content onClick', () => {
    const wrapper = mount(<ComponentChildComponent />)

    wrapper.act(() => {
      wrapper.find('div')?.trigger('onKeyUp', {key: 'Enter'})
    })

    expect(handleClick).toHaveBeenCalled()
  })
})
