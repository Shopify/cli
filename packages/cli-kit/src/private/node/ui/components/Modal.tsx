import {FullScreen} from './FullScreen.js'
import React, {FunctionComponent} from 'react'

interface ModalProps {}

const Modal: FunctionComponent<ModalProps> = ({children}) => {
  return (
    <FullScreen closeOnKey="q">
      {children}
    </FullScreen>
  )
}

export {Modal}
