import React from 'react'

export interface Link {
  label: string | undefined
  url: string
}

export interface ContextValue {
  links: React.RefObject<{[key: string]: Link}>
  addLink: (label: string | undefined, url: string) => string
}

export const LinksContext = React.createContext<ContextValue | null>(null)
