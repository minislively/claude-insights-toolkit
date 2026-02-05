import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { OverviewPage } from '@/pages/OverviewPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { BottlenecksPage } from '@/pages/BottlenecksPage'
import { TrendsPage } from '@/pages/TrendsPage'
import { ReportsPage } from '@/pages/ReportsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="bottlenecks" element={<BottlenecksPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
