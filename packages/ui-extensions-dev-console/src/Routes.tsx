import React from 'react'
import {Routes as ReactRouterRoutes, Route} from 'react-router-dom'
import {Extensions} from '@/sections/Extensions'
import {Home} from '@/sections/Home'

export default function Routes() {
  return (
    <ReactRouterRoutes>
      <Route path="/" element={<Home />} />
      <Route path="/extensions" element={<Extensions />} />
    </ReactRouterRoutes>
  )
}
