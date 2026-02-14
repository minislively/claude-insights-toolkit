import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { LoadingState } from '@/components/LoadingState'

const OverviewPage = lazy(() => import('@/pages/OverviewPage').then(m => ({ default: m.OverviewPage })))
const SessionsPage = lazy(() => import('@/pages/SessionsPage').then(m => ({ default: m.SessionsPage })))
const BottlenecksPage = lazy(() => import('@/pages/BottlenecksPage').then(m => ({ default: m.BottlenecksPage })))
const TrendsPage = lazy(() => import('@/pages/TrendsPage').then(m => ({ default: m.TrendsPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const ApiErrorsPage = lazy(() => import('@/pages/ApiErrorsPage').then(m => ({ default: m.ApiErrorsPage })))
const CategorySuccessPage = lazy(() => import('@/pages/CategorySuccessPage').then(m => ({ default: m.CategorySuccessPage })))
const SessionEfficiencyPage = lazy(() => import('@/pages/SessionEfficiencyPage').then(m => ({ default: m.SessionEfficiencyPage })))
const HelpfulnessPage = lazy(() => import('@/pages/HelpfulnessPage').then(m => ({ default: m.HelpfulnessPage })))
const TimePatternsPage = lazy(() => import('@/pages/TimePatternsPage').then(m => ({ default: m.TimePatternsPage })))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
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
      </Suspense>
    </BrowserRouter>
  )
}

export default App
