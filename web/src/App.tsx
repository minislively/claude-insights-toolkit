import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { OverviewPage } from '@/pages/OverviewPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { BottlenecksPage } from '@/pages/BottlenecksPage'
import { TrendsPage } from '@/pages/TrendsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ApiErrorsPage } from '@/pages/ApiErrorsPage'
import { CategorySuccessPage } from '@/pages/CategorySuccessPage'
import { SessionEfficiencyPage } from '@/pages/SessionEfficiencyPage'
import { HelpfulnessPage } from '@/pages/HelpfulnessPage'
import { TimePatternsPage } from '@/pages/TimePatternsPage'

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
          <Route path="profile" element={<ProfilePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="api-errors" element={<ApiErrorsPage />} />
          <Route path="category-success" element={<CategorySuccessPage />} />
          <Route path="session-efficiency" element={<SessionEfficiencyPage />} />
          <Route path="helpfulness" element={<HelpfulnessPage />} />
          <Route path="time-patterns" element={<TimePatternsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
