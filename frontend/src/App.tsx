import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Chat from './pages/Chat'
import GirlProfile from './pages/GirlProfile'
import UserProfile from './pages/UserProfile'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/girls/:girlId/chat" element={<Chat />} />
        <Route path="/girls/:girlId/profile" element={<GirlProfile />} />
        <Route path="/user" element={<UserProfile />} />
      </Routes>
    </Layout>
  )
}

export default App
