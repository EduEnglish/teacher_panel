import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { unitSchema, type UnitFormValues } from '@/utils/schemas'
import { statusOptions } from '@/utils/constants'
import { gradeService, unitService } from '@/services/firebase'
import type { Grade, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type UnitTableRow = Unit & { gradeName: string }

export function UnitsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const gradeFilter = useMemo(() => (selectedGradeId === 'all' ? undefined : [where('gradeId', '==', selectedGradeId)]), [selectedGradeId])
  const { data: units, isLoading } = useCollection<Unit>(unitService.listen, gradeFilter)

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema) as any,
    defaultValues: {
      gradeId: '',
      number: 1,
      title: '',
      description: '',
      status: 'active',
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
        title: editingUnit.title,
        description: editingUnit.description ?? '',
        status: editingUnit.status,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        number: 1,
        title: '',
        description: '',
        status: 'active',
      })
    }
  }, [editingUnit, selectedGradeId, form])

  const rows = useMemo<UnitTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    return units
      .map((unit) => ({
        ...unit,
        gradeName: gradeMap.get(unit.gradeId) ?? '—',
      }))
      .sort((a, b) => a.number - b.number)
  }, [units, grades])

  const handleOpenNew = () => {
    setEditingUnit(null)
    setIsModalOpen(true)
  }

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit)
    setIsModalOpen(true)
  }

  const handleDelete = async (unit: Unit) => {
    const confirmed = await confirmAction({
      title: 'Delete unit?',
      description: `Are you sure you want to delete "${unit.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await unitService.remove(unit.id, user.uid, { title: unit.title, gradeId: unit.gradeId })
      notifySuccess('Unit deleted successfully')
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
      if (editingUnit) {
        await unitService.update(
          editingUnit.id,
          {
            gradeId: values.gradeId,
            number: values.number,
            title: values.title,
            description: values.description?.trim() || '',
            status: values.status,
          },
          user.uid,
          { title: values.title },
        )
        notifySuccess('Unit updated successfully')
      } else {
        await unitService.create(
          {
            gradeId: values.gradeId,
            number: values.number,
            title: values.title,
            description: values.description?.trim() || '',
            status: values.status,
          } as Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        notifySuccess('Unit created successfully')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save unit', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<UnitTableRow>> = [
    {
      key: 'number',
      header: '#',
      width: '60px',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.number}</span>,
    },
    { key: 'title', header: 'Unit Title' },
    { key: 'gradeName', header: 'Grade' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>,
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
        description="Units group lessons and assessments by theme."
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
                      {grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Unit 3: Storytelling" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional summary" {...field} />
                  </FormControl>
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


