import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { CurriculumCacheProvider } from '@/context/CurriculumCacheContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CurriculumPage } from '@/pages/curriculum/CurriculumPage'
import { GradesPage } from '@/pages/curriculum/GradesPage'
import { UnitsPage } from '@/pages/curriculum/UnitsPage'
import { LessonsPage } from '@/pages/curriculum/LessonsPage'
import { SectionsPage } from '@/pages/curriculum/SectionsPage'
import { QuizzesPage } from '@/pages/curriculum/QuizzesPage'
import { QuestionsPage } from '@/pages/curriculum/QuestionsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { StudentsPage } from '@/pages/students/StudentsPage'

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <CurriculumCacheProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/curriculum">
                  <Route index element={<CurriculumPage />} />
                  <Route path="grades" element={<GradesPage />} />
                  <Route path=":gradeId/units" element={<UnitsPage />} />
                  <Route path=":gradeId/:unitId/lessons" element={<LessonsPage />} />
                  <Route path=":gradeId/:unitId/:lessonId/sections" element={<SectionsPage />} />
                  <Route path=":gradeId/:unitId/:lessonId/:sectionId/quizzes/*" element={<QuizzesPage />} />
                  <Route path=":gradeId/:unitId/:lessonId/:sectionId/:quizId/questions" element={<QuestionsPage />} />
                </Route>
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
          </BrowserRouter>
          <Toaster richColors />
        </CurriculumCacheProvider>
      </UIProvider>
    </AuthProvider>
  )
}

export default App
