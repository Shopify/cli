import React from 'react'
import {BrowserRouter, Routes as ReactRouterRoutes, Route} from 'react-router-dom'
import {Home} from '@/sections/Home'
import {Extensions} from '@/sections/Extensions'

export default function Routes() {
  return (
    <BrowserRouter>
      <ReactRouterRoutes>
        <Route path="/" element={<Home />} />
        <Route path="/extensions/*" element={<Extensions />} />
      </ReactRouterRoutes>
    </BrowserRouter>
  )
}
