import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import 'leaflet/dist/leaflet.css'
import './styles/globals.css'

// StrictMode is intentionally removed — it double-mounts components in dev
// which breaks Leaflet's single-initialisation model.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
