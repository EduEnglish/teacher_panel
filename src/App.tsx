import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { GradesPage } from '@/pages/curriculum/GradesPage'
import { UnitsPage } from '@/pages/curriculum/UnitsPage'
import { LessonsPage } from '@/pages/curriculum/LessonsPage'
import { SectionsPage } from '@/pages/curriculum/SectionsPage'
import { QuizzesPage } from '@/pages/curriculum/QuizzesPage'
import { SpecialLessonsPage } from '@/pages/curriculum/SpecialLessonsPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/curriculum">
                  <Route index element={<Navigate to="/curriculum/grades" replace />} />
                  <Route path="grades" element={<GradesPage />} />
                  <Route path="units" element={<UnitsPage />} />
                  <Route path="lessons" element={<LessonsPage />} />
                  <Route path="sections" element={<SectionsPage />} />
                  <Route path="quizzes/*" element={<QuizzesPage />} />
                  <Route path="special-lessons" element={<SpecialLessonsPage />} />
                </Route>
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </UIProvider>
    </AuthProvider>
  )
}

export default App
