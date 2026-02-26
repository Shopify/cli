import App from './App'
import React from 'react'
import {createRoot} from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
