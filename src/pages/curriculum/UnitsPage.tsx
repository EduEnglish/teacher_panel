import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { unitSchema, type UnitFormValues } from '@/utils/schemas'
import { gradeService } from '@/services/firebase'
import { hierarchicalUnitService } from '@/services/hierarchicalServices'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Grade, Unit } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type UnitTableRow = Unit & { gradeName: string; lessonCount: number }

export function UnitsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, isLoading: cacheLoading, refreshUnits } = useCurriculumCache()
  
  // Auto-select first grade if only one exists
  useEffect(() => {
    if (grades.length === 1 && selectedGradeId === 'all') {
      setSelectedGradeId(grades[0].id)
    }
  }, [grades, selectedGradeId])
  
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Listen to units for selected grade (hierarchical structure)
  useEffect(() => {
    if (selectedGradeId === 'all' || !selectedGradeId) {
      // If 'all', use cached data from context
      setUnits(cachedAllUnits)
      setIsLoading(cacheLoading)
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalUnitService.listen(
      selectedGradeId,
      (data) => {
        setUnits(data)
        setIsLoading(false)
      },
      undefined,
    )

    return unsubscribe
  }, [selectedGradeId, cachedAllUnits, cacheLoading])

  // Use cached lessons from context
  const allLessons = cachedAllLessons

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema) as any,
    defaultValues: {
      gradeId: '',
      number: 1,
      isPublished: false,
    },
  })

  useEffect(() => {
    setPageTitle('Unit Management')
  }, [setPageTitle])

  useEffect(() => {
    if (editingUnit) {
      form.reset({
        id: editingUnit.id,
        gradeId: editingUnit.gradeId,
        number: editingUnit.number,
        isPublished: editingUnit.isPublished ?? false,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        number: 1,
        isPublished: false,
      })
    }
  }, [editingUnit, selectedGradeId, form])

  const rows = useMemo<UnitTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const lessonsPerUnit = allLessons.reduce<Record<string, number>>((acc, lesson) => {
      const key = `${lesson.gradeId}_${lesson.unitId}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    return units
      .map((unit) => ({
        ...unit,
        gradeName: gradeMap.get(unit.gradeId) ?? '—',
        lessonCount: lessonsPerUnit[`${unit.gradeId}_${unit.id}`] ?? 0,
      }))
      .sort((a, b) => {
        // First sort by grade name (alphabetically)
        const gradeCompare = (a.gradeName || '').localeCompare(b.gradeName || '')
        if (gradeCompare !== 0) return gradeCompare
        // Then sort by unit number within the same grade
        return a.number - b.number
      })
  }, [units, grades, allLessons])

  const handleOpenNew = () => {
    setEditingUnit(null)
    setIsModalOpen(true)
  }

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit)
    setIsModalOpen(true)
  }

  const handleTogglePublish = async (unit: Unit) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    if (!unit.gradeId) {
      notifyError('Invalid unit', 'Unit missing gradeId')
      return
    }
    
    // Optimistic update
    const newPublishedState = !unit.isPublished
    setUnits((prevUnits) =>
      prevUnits.map((u) => (u.id === unit.id ? { ...u, isPublished: newPublishedState } : u)),
    )
    
    try {
      await hierarchicalUnitService.update(unit.gradeId, unit.id, {
        isPublished: newPublishedState,
      })
      notifySuccess(newPublishedState ? 'Unit published' : 'Unit unpublished')
    } catch (error) {
      // Revert on error
      setUnits((prevUnits) =>
        prevUnits.map((u) => (u.id === unit.id ? { ...u, isPublished: unit.isPublished } : u)),
      )
      notifyError('Unable to update unit', error instanceof Error ? error.message : undefined)
    }
  }

  const handleDelete = async (unit: Unit) => {
    const confirmed = await confirmAction({
      title: 'Delete unit?',
      description: `Are you sure you want to delete Unit ${unit.number}?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!unit.gradeId) {
        notifyError('Invalid unit', 'Unit missing gradeId')
        return
      }
      await hierarchicalUnitService.remove(unit.gradeId, unit.id)
      // Log action manually since hierarchical service doesn't do it
      await gradeService.update(unit.gradeId, {}, user.uid, { action: 'delete_unit', unitId: unit.id })
      notifySuccess('Unit deleted successfully')
      refreshUnits() // Refresh cache
    } catch (error) {
      notifyError('Unable to delete unit', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!values.gradeId) {
        notifyError('Grade required', 'Please select a grade')
        return
      }

      // Check for duplicate unit number in the same grade
      const duplicateUnit = units.find(
        (u) => u.number === values.number && u.gradeId === values.gradeId && u.id !== editingUnit?.id,
      )
      if (duplicateUnit) {
        notifyError('Duplicate unit', `Unit ${values.number} already exists for this grade.`)
        return
      }

      if (editingUnit) {
        if (!editingUnit.gradeId) {
          notifyError('Invalid unit', 'Unit missing gradeId')
          return
        }
        await hierarchicalUnitService.update(
          editingUnit.gradeId,
          editingUnit.id,
          {
            number: values.number,
            isPublished: values.isPublished,
          },
        )
        // Log action
        await gradeService.update(editingUnit.gradeId, {}, user.uid, { action: 'update_unit', unitId: editingUnit.id })
        notifySuccess('Unit updated successfully')
        refreshUnits() // Refresh cache
      } else {
        await hierarchicalUnitService.create(values.gradeId, {
          number: values.number,
          isPublished: values.isPublished,
        })
        // Log action
        await gradeService.update(values.gradeId, {}, user.uid, { action: 'create_unit' })
        notifySuccess('Unit created successfully')
        refreshUnits() // Refresh cache
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save unit', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<UnitTableRow>> = [
    {
      key: 'number',
      header: 'Units',
      width: '60px',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.number}</span>,
    },
    { 
      key: 'gradeName', 
      header: 'Grade',
      render: (row) => (
        <div className="truncate max-w-[150px]" title={row.gradeName}>
          {row.gradeName}
        </div>
      ),
    },
    {
      key: 'lessonCount',
      header: 'Lessons',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.lessonCount}</span>,
    },
    {
      key: 'isPublished',
      header: 'Published',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch 
            checked={row.isPublished ?? false} 
            onCheckedChange={(checked) => {
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
          <h2 className="text-2xl font-semibold text-foreground">Units</h2>
          <p className="text-sm text-muted-foreground">Group lessons into structured units aligned to each grade.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedGradeId} onValueChange={(value: string) => setSelectedGradeId(value as typeof selectedGradeId)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {grades.map((grade) => (
                <SelectItem key={grade.id} value={grade.id}>
                  {grade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleOpenNew} className="rounded-full px-6">
            Add Unit
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No units yet. Start by adding a unit for your selected grade."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUnit ? 'Edit Unit' : 'Add Unit'}
        description="Units organize lessons within a grade."
        onSubmit={onSubmit}
        submitLabel={editingUnit ? 'Update Unit' : 'Create Unit'}
        isSubmitting={form.formState.isSubmitting}
      >
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              name="gradeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {grades.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No grades available. Please create a grade first.
                        </div>
                      ) : (
                        grades.map((grade) => (
                          <SelectItem key={grade.id} value={grade.id}>
                            {grade.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Number</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={field.value ?? 1}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
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
                    <p className="text-xs text-muted-foreground">Only published units appear to students.</p>
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


