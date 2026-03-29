import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Chat from './pages/Chat'
import MyVitals from './pages/MyVitals'
import RecoveryPlan from './pages/RecoveryPlan'
import Privacy from './pages/Privacy'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/vitals" element={<MyVitals />} />
      <Route path="/plan" element={<RecoveryPlan />} />
      <Route path="/privacy" element={<Privacy />} />
    </Routes>
  )
}
