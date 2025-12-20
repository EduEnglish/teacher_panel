import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { gradeSchema, type GradeFormValues } from '@/utils/schemas'
import { gradeService } from '@/services/firebase'
import { hierarchicalUnitService } from '@/services/hierarchicalServices'
import type { Grade, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'

type GradeTableRow = Grade & { unitCount: number }

export function GradesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)

  const { data: grades, isLoading: gradesLoading } = useCollection<Grade>(gradeService.listen)
  const [allUnits, setAllUnits] = useState<Unit[]>([])

  // Load all units from all grades (for counting)
  useEffect(() => {
    if (grades.length === 0) {
      setAllUnits([])
      return
    }

    const loadAllUnits = async () => {
      const unitsPromises = grades.map((grade) => hierarchicalUnitService.getAll(grade.id))
      const unitsArrays = await Promise.all(unitsPromises)
      setAllUnits(unitsArrays.flat())
    }

    loadAllUnits()
  }, [grades])

  const form = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      name: '',
      description: undefined,
      isPublished: false,
    },
  })

  // Watch grade name to auto-select description
  const gradeName = useWatch({
    control: form.control,
    name: 'name',
  })

  // Map grade to age range
  const getAgeRangeForGrade = (grade: string): string | undefined => {
    const gradeMap: Record<string, string> = {
      'Grade 5': 'Ages 10–11 years',
      'Grade 6': 'Ages 11–12 years',
      'Grade 7': 'Ages 12–13 years',
      'Grade 8': 'Ages 13–14 years',
      'Grade 9': 'Ages 14–15 years',
      'Grade 10': 'Ages 15–16 years',
      'Grade 11': 'Ages 16–17 years',
      'Grade 12': 'Ages 17–18 years',
    }
    return gradeMap[grade]
  }

  // Auto-set description when grade name changes
  useEffect(() => {
    if (gradeName) {
      const ageRange = getAgeRangeForGrade(gradeName)
      if (ageRange) {
        form.setValue('description', ageRange, { shouldValidate: false })
      }
    }
  }, [gradeName, form])

  useEffect(() => {
    setPageTitle('Grade Management')
  }, [setPageTitle])

  const rows = useMemo<GradeTableRow[]>(() => {
    const unitsPerGrade = allUnits.reduce<Record<string, number>>((acc, unit) => {
      acc[unit.gradeId] = (acc[unit.gradeId] ?? 0) + 1
      return acc
    }, {})

    return grades
      .map((grade) => ({
        ...grade,
        unitCount: unitsPerGrade[grade.id] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [grades, allUnits])

  useEffect(() => {
    if (editingGrade) {
      // When editing, use the stored description or auto-set based on grade name
      const description = editingGrade.description || getAgeRangeForGrade(editingGrade.name)
      form.reset({
        id: editingGrade.id,
        name: editingGrade.name,
        description: description || undefined,
        isPublished: editingGrade.isPublished ?? false,
      })
    } else {
      form.reset({
        name: '',
        description: undefined,
        isPublished: false,
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

  const handleTogglePublish = async (grade: Grade) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    
    // Optimistic update
    const newPublishedState = !grade.isPublished
    try {
      await gradeService.update(
        grade.id,
        {
          isPublished: newPublishedState,
        },
        user.uid,
        { name: grade.name },
      )
      notifySuccess(newPublishedState ? 'Grade published' : 'Grade unpublished')
    } catch (error) {
      notifyError('Unable to update grade', error instanceof Error ? error.message : undefined)
    }
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
      // Check for duplicate grade name (case-insensitive)
      const duplicateGrade = grades.find(
        (g) => g.name.toLowerCase().trim() === values.name.toLowerCase().trim() && g.id !== editingGrade?.id,
      )
      if (duplicateGrade) {
        notifyError('Duplicate grade', `A grade with the name "${values.name}" already exists.`)
        return
      }

      if (editingGrade) {
        await gradeService.update(
          editingGrade.id,
          {
            name: values.name,
            description: values.description?.trim() || '',
            isPublished: values.isPublished,
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
            isPublished: values.isPublished,
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
    { 
      key: 'name', 
      header: 'Grade Name',
      render: (row) => (
        <div className="whitespace-normal break-words" title={row.name}>
          {row.name}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div className="whitespace-normal break-words" title={row.description || ''}>
          <span className="text-muted-foreground">{row.description || <span className="italic text-muted-foreground/60">No description</span>}</span>
        </div>
      ),
    },
    {
      key: 'unitCount',
      header: 'Units',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.unitCount}</span>,
    },
    {
      key: 'isPublished',
      header: 'Published',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch 
            checked={row.isPublished ?? false} 
            onCheckedChange={() => {
              handleTogglePublish(row)
            }}
          />
        </div>
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
        onRowClick={(grade) => navigate(`/curriculum/${grade.id}/units`)}
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
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade name" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Grade 5">Grade 5</SelectItem>
                      <SelectItem value="Grade 6">Grade 6</SelectItem>
                      <SelectItem value="Grade 7">Grade 7</SelectItem>
                      <SelectItem value="Grade 8">Grade 8</SelectItem>
                      <SelectItem value="Grade 9">Grade 9</SelectItem>
                      <SelectItem value="Grade 10">Grade 10</SelectItem>
                      <SelectItem value="Grade 11">Grade 11</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                    disabled={true}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age range (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Ages 10–11 years">Ages 10–11 years</SelectItem>
                      <SelectItem value="Ages 11–12 years">Ages 11–12 years</SelectItem>
                      <SelectItem value="Ages 12–13 years">Ages 12–13 years</SelectItem>
                      <SelectItem value="Ages 13–14 years">Ages 13–14 years</SelectItem>
                      <SelectItem value="Ages 14–15 years">Ages 14–15 years</SelectItem>
                      <SelectItem value="Ages 15–16 years">Ages 15–16 years</SelectItem>
                      <SelectItem value="Ages 16–17 years">Ages 16–17 years</SelectItem>
                      <SelectItem value="Ages 17–18 years">Ages 17–18 years</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Publish to Mobile App</FormLabel>
                    <p className="text-xs text-muted-foreground">Only published grades appear to students.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


