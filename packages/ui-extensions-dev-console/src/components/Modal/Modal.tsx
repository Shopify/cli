import {Dialog, Header, Backdrop} from './components'
import styles from './Modal.module.scss'

import {TransitionGroup} from 'react-transition-group'
import React, {useState} from 'react'
import {createPortal} from 'react-dom'
import {ModalContainerId} from '@/foundation/ModalContainer'

export interface ModalProps {
  /** Whether the modal is open or not */
  open: boolean
  /** The content for the title of the modal */
  title: React.ReactElement | string
  /** The content to display inside modal */
  children: React.ReactNode
  /** Callback when the modal is closed */
  onClose(): void
  /** Width of the Modal, default: 'large' */
  width?: 'small' | 'large'
}

export function Modal({children, title, open, onClose, width = 'large'}: ModalProps) {
  const [closing, setClosing] = useState(false)

  let dialog: React.ReactNode
  let backdrop: React.ReactNode

  if (open) {
    dialog = (
      <Dialog labelledBy={'modal-header'} onClose={onClose} setClosing={setClosing} in={open} width={width}>
        <Header id={'modal-header'} closing={closing} onClose={onClose}>
          {title}
        </Header>
        <div className={styles.BodyWrapper}>{children}</div>
      </Dialog>
    )

    backdrop = <Backdrop setClosing={setClosing} onClick={onClose} />
  }

  const modalContainer = document.getElementById(ModalContainerId)

  if (modalContainer === null) {
    if (open) {
      // eslint-disable-next-line no-console
      console.error(`Could not find element with id ${ModalContainerId} to render Modal inside`)
    }
    return null
  }

  return createPortal(
    <>
      <TransitionGroup appear={true} enter={true} exit={true}>
        {dialog}
      </TransitionGroup>
      {backdrop}
    </>,
    modalContainer,
  )
}
