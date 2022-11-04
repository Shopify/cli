import {usePolarisToast} from './usePolarisToast'
import React, {createContext, useContext, useMemo} from 'react'
import {Frame} from '@shopify/polaris'

interface ToastContextProps {
  show: ReturnType<typeof usePolarisToast>[1]
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined)

interface ToastProviderProps {
  children: React.ReactNode
}

const style = {
  display: 'none',
}

export function ToastProvider({children}: ToastProviderProps) {
  const [Toast, show] = usePolarisToast()
  const value = useMemo(() => ({show}), [show])

  return (
    <ToastContext.Provider value={value}>
      <div style={style}>
        <Frame>
          <Toast />
        </Frame>
      </div>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) {
    throw new Error('Missing ToastContext')
  }
  return toast.show
}
