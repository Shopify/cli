import styles from './Dialog.module.scss'

import React, {useRef, SetStateAction, Dispatch, useLayoutEffect} from 'react'
import {CSSTransition} from 'react-transition-group'
import {focusFirstFocusableNode} from '@/utilities/focus'
import {classNames} from '@/utilities/css'

enum Key {
  Escape = 27,
}

export interface DialogProps {
  labelledBy?: string
  children?: React.ReactNode
  onClose(): void
  setClosing: Dispatch<SetStateAction<boolean>>
}

export function Dialog({labelledBy, children, onClose, setClosing}: DialogProps) {
  const containerNode = useRef<HTMLDivElement>(null)

  const ensureFocusInsideModal = () => {
    // eslint-disable-next-line @babel/no-unused-expressions
    containerNode.current &&
      !containerNode.current.contains(document.activeElement) &&
      focusFirstFocusableNode(containerNode.current)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.keyCode === Key.Escape) {
      setClosing(true)
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.keyCode === Key.Escape) {
      setClosing(false)
      onClose()
    }
  }

  const handleBlur = (event: Event) => {
    // TODO: Ensure this works
    // Focus should stay inside Modal
    ensureFocusInsideModal()
  }

  useLayoutEffect(ensureFocusInsideModal, [])

  useLayoutEffect(() => {
    document.addEventListener('keydown', handleKeyDown, false)
    document.addEventListener('keyup', handleKeyUp, false)
    document.addEventListener('blue', handleBlur, false)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, false)
      document.addEventListener('keyup', handleKeyUp, false)
      document.addEventListener('blue', handleBlur, true)
    }
  }, [handleKeyDown])

  return (
    <CSSTransition classNames={fadeUpClasses} nodeRef={containerNode} mountOnEnter unmountOnExit timeout={200}>
      <div className={styles.Container} ref={containerNode}>
        <div role="dialog" aria-modal aria-labelledby={labelledBy} tabIndex={-1} className={styles.Dialog}>
          <div className={styles.Modal}>{children}</div>
        </div>
      </div>
    </CSSTransition>
  )
}

const fadeUpClasses = {
  appear: classNames(styles.animateFadeUp, styles.entering),
  appearActive: classNames(styles.animateFadeUp, styles.entered),
  enter: classNames(styles.animateFadeUp, styles.entering),
  enterActive: classNames(styles.animateFadeUp, styles.entered),
  exit: classNames(styles.animateFadeUp, styles.exiting),
  exitActive: classNames(styles.animateFadeUp, styles.exited),
}
