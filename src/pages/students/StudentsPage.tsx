import { useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { studentService } from '@/services/firebase'
import type { Student } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useUI } from '@/context/UIContext'
import { formatDateTime } from '@/utils/formatters'

export function StudentsPage() {
  const { setPageTitle } = useUI()

  const { data: students, isLoading } = useCollection<Student>(studentService.listen)

  useEffect(() => {
    setPageTitle('Students')
  }, [setPageTitle])

  const filteredStudents = useMemo(() => {
    // Sort by created date (newest first, then students without created date at the end)
    return [...students].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return b.createdAt.toMillis() - a.createdAt.toMillis()
    })
  }, [students])

  const columns: Array<DataTableColumn<Student>> = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <p className="font-semibold text-foreground">{row.name}</p>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.email || '—'}
        </span>
      ),
    },
    {
      key: 'enrolledAt',
      header: 'Enrolled',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.createdAt ? formatDateTime(row.createdAt) : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-foreground">Students</h2>
            {!isLoading && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {filteredStudents.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">View all students and their learning progress across all grades.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Student Performance</CardTitle>
          <CardDescription>
            View all students and their learning progress across all grades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredStudents}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No students found. Students will appear here once they start practicing."
          />
        </CardContent>
      </Card>
    </div>
  )
}

