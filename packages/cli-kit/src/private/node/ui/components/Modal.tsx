import {Banner} from './Banner.js'
import {FullScreen} from './FullScreen.js'
import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface ModalProps {
  onClose: () => void
}

const Modal: FunctionComponent<ModalProps> = ({children, onClose}) => {
  return (
    <FullScreen onClose={onClose} closeOnKey="q">
      <Banner type="info" title='Press "q" to close'><Text>{children}</Text></Banner>
    </FullScreen>
  )
}

export {Modal}
