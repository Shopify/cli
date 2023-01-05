import React from 'react'
import {BrowserRouter, Routes as ReactRouterRoutes, Route} from 'react-router-dom'
import {Extensions} from '@/sections/Extensions'

export function Routes() {
  return (
    <BrowserRouter>
      <ReactRouterRoutes>
        <Route path="*" element={<Extensions />} />
      </ReactRouterRoutes>
    </BrowserRouter>
  )
}
