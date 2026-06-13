import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
import { applyTheme, getTheme } from './utils/theme'

// Reflect the saved theme (the inline script in index.html also does this early
// to avoid a flash; this keeps things correct if that script is ever stripped).
applyTheme(getTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
