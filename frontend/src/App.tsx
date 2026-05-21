import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Chat from './pages/Chat'
import GirlProfile from './pages/GirlProfile'
import UserProfile from './pages/UserProfile'
import DebugPrompt from './pages/DebugPrompt'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/girls/:girlId/chat" element={<Chat />} />
        <Route path="/girls/:girlId/profile" element={<GirlProfile />} />
        <Route path="/user" element={<UserProfile />} />
        <Route path="/debug" element={<DebugPrompt />} />
      </Routes>
    </Layout>
  )
}

export default App
