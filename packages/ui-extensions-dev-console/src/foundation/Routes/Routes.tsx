import {Extensions} from '@/sections/Extensions'
import React from 'react'
import {BrowserRouter, Routes as ReactRouterRoutes, Route} from 'react-router-dom'

export function Routes() {
  return (
    <BrowserRouter>
      <ReactRouterRoutes>
        <Route path="*" element={<Extensions />} />
      </ReactRouterRoutes>
    </BrowserRouter>
  )
}
