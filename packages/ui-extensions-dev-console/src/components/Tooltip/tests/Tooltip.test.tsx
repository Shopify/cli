import {Tooltip} from '../Tooltip'
import React from 'react'
import {render, screen, fireEvent, act} from '@testing-library/react'

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
    ['mouseEnter', 'mouseLeave'],
    ['focus', 'blur'],
  ] as const)('appears if hovered/focused/etc, hidden otherwise', (showEvent, hideEvent) => {
    render(<TextChildComponent />)

    const trigger = screen.getByText('test')

    act(() => {
      fireEvent[showEvent](trigger)
    })

    expect(screen.queryByRole('tooltip')).toBeInTheDocument()

    act(() => {
      fireEvent[hideEvent](trigger)
    })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  test('hitting enter triggers content onClick', () => {
    render(<ComponentChildComponent />)

    const trigger = screen.getByText('Button').closest('div[tabindex]')!

    act(() => {
      fireEvent.keyUp(trigger, {key: 'Enter'})
    })

    expect(handleClick).toHaveBeenCalled()
  })
})
