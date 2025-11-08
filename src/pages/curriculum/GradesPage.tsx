import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { gradeSchema, type GradeFormValues } from '@/utils/schemas'
import { statusOptions } from '@/utils/constants'
import { gradeService, unitService } from '@/services/firebase'
import type { Grade, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'

type GradeTableRow = Grade & { unitCount: number }

export function GradesPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)

  const { data: grades, isLoading: gradesLoading } = useCollection<Grade>(gradeService.listen)
  const { data: units } = useCollection<Unit>(unitService.listen)

  const form = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
    },
  })

  useEffect(() => {
    setPageTitle('Grade Management')
  }, [setPageTitle])

  const rows = useMemo<GradeTableRow[]>(() => {
    const unitsPerGrade = units.reduce<Record<string, number>>((acc, unit) => {
      acc[unit.gradeId] = (acc[unit.gradeId] ?? 0) + 1
      return acc
    }, {})

    return grades
      .map((grade) => ({
        ...grade,
        unitCount: unitsPerGrade[grade.id] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [grades, units])

  useEffect(() => {
    if (editingGrade) {
      form.reset({
        id: editingGrade.id,
        name: editingGrade.name,
        description: editingGrade.description ?? '',
        status: editingGrade.status,
      })
    } else {
      form.reset({
        name: '',
        description: '',
        status: 'active',
      })
    }
  }, [editingGrade, form])

  const handleOpenNew = () => {
    setEditingGrade(null)
    setIsModalOpen(true)
  }

  const handleEdit = (grade: Grade) => {
    setEditingGrade(grade)
    setIsModalOpen(true)
  }

  const handleDelete = async (grade: Grade) => {
    const confirmed = await confirmAction({
      title: 'Delete grade?',
      description: `Are you sure you want to delete "${grade.name}"? Related units and lessons will stay orphaned.`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await gradeService.remove(grade.id, user.uid, { name: grade.name })
      notifySuccess('Grade deleted')
    } catch (error) {
      notifyError('Unable to delete grade', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (editingGrade) {
        await gradeService.update(
          editingGrade.id,
          {
            name: values.name,
            description: values.description?.trim() || '',
            status: values.status,
          },
          user.uid,
          { name: values.name },
        )
        notifySuccess('Grade updated successfully')
      } else {
        await gradeService.create(
          {
            name: values.name,
            description: values.description?.trim() || '',
            status: values.status,
          } as Omit<Grade, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { name: values.name },
        )
        notifySuccess('Grade created successfully')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save grade', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<GradeTableRow>> = [
    { key: 'name', header: 'Grade Name' },
    {
      key: 'unitCount',
      header: 'Units',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.unitCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status === 'active' ? 'Active' : 'Inactive'}</Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Grades</h2>
          <p className="text-sm text-muted-foreground">Create and organize grade levels for the EduEnglish curriculum.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Grade
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={gradesLoading}
        emptyMessage="No grades configured yet. Start by adding your first grade level."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGrade ? 'Edit Grade' : 'Add Grade'}
        description="Define the grade level that encapsulates multiple units."
        onSubmit={onSubmit}
        submitLabel={editingGrade ? 'Update Grade' : 'Create Grade'}
        isSubmitting={form.formState.isSubmitting}
      >
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Grade 4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional context for this grade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


