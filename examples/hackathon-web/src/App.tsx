import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DemoPage from './pages/DemoPage'
import PlaygroundPage from './pages/PlaygroundPage'
import AiPayPage from './pages/AiPayPage'
import QuickstartPage from './pages/QuickstartPage'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/client-auth" element={<Navigate to="/ai-pay?tab=auth" replace />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/ai-pay" element={<AiPayPage />} />
          <Route path="/quickstart" element={<QuickstartPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
