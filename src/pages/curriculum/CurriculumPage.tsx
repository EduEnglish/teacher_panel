import { Navigate } from 'react-router-dom'

// This component redirects to the grades page
// The actual grades page will be shown at /curriculum
export function CurriculumPage() {
  return <Navigate to="/curriculum/grades" replace />
}

