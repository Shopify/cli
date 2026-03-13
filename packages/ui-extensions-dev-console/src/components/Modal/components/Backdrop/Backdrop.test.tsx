import {Backdrop} from '.'
import React from 'react'
import {render, fireEvent} from '@testing-library/react'

describe('<Backdrop />', () => {
  const defaultProps = {
    onClick: vi.fn(),
    setClosing: vi.fn(),
  }

  describe('onClick()', () => {
    test('is called when the backdrop is clicked', () => {
      const spy = vi.fn()
      const {container} = render(<Backdrop {...defaultProps} onClick={spy} />)
      fireEvent.click(container.firstElementChild!)
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('onMouseDown', () => {
    test('calls setClosing()', () => {
      const spy = vi.fn()
      const {container} = render(<Backdrop {...defaultProps} setClosing={spy} />)
      fireEvent.mouseDown(container.firstElementChild!)
      expect(spy).toHaveBeenCalledWith(true)
    })
  })

  describe('onMouseUp', () => {
    test('calls setClosing()', () => {
      const spy = vi.fn()
      const {container} = render(<Backdrop {...defaultProps} setClosing={spy} />)
      fireEvent.mouseUp(container.firstElementChild!)
      expect(spy).toHaveBeenCalledWith(false)
    })

    test('calls onClick()', () => {
      const spy = vi.fn()
      const {container} = render(<Backdrop {...defaultProps} onClick={spy} />)
      fireEvent.mouseUp(container.firstElementChild!)
      expect(spy).toHaveBeenCalled()
    })
  })
})
