import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AmbientDoc from './pages/AmbientDoc'
import WarRoom from './pages/WarRoom'
import Privacy from './pages/Privacy'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/ambient" element={<AmbientDoc />} />
      <Route path="/warroom" element={<WarRoom />} />
      <Route path="/privacy" element={<Privacy />} />
    </Routes>
  )
}
