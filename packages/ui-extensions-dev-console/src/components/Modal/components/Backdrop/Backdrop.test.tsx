import {Backdrop} from '.'
import React from 'react'
import {render} from '@shopify/ui-extensions-test-utils'

describe('<Backdrop />', () => {
  const defaultProps = {
    onClick: vi.fn(),
    setClosing: vi.fn(),
  }

  describe('onClick()', () => {
    test('is called when the backdrop is clicked', () => {
      const spy = vi.fn()
      const backdrop = render(<Backdrop {...defaultProps} onClick={spy} />)
      backdrop.find('div')!.trigger('onClick')
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('onMouseDown', () => {
    test('calls setClosing()', () => {
      const spy = vi.fn()
      const backdrop = render(<Backdrop {...defaultProps} setClosing={spy} />)
      backdrop.find('div')!.trigger('onMouseDown')
      expect(spy).toHaveBeenCalledWith(true)
    })
  })

  describe('onMouseUp', () => {
    test('calls setClosing()', () => {
      const spy = vi.fn()
      const backdrop = render(<Backdrop {...defaultProps} setClosing={spy} />)
      backdrop.find('div')!.trigger('onMouseUp')
      expect(spy).toHaveBeenCalledWith(false)
    })

    test('calls setClosing()', () => {
      const spy = vi.fn()
      const backdrop = render(<Backdrop {...defaultProps} onClick={spy} />)
      backdrop.find('div')!.trigger('onMouseUp')
      expect(spy).toHaveBeenCalled()
    })
  })
})
