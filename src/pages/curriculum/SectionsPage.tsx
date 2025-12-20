import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Play, Upload, X, Loader2, Maximize2 } from 'lucide-react'
import { deleteField } from 'firebase/firestore'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { PageLoader } from '@/components/feedback/PageLoader'
import { sectionSchema, type SectionFormValues } from '@/utils/schemas'
import { hierarchicalSectionService } from '@/services/hierarchicalServices'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Section } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { uploadImageToStorage, validateImageFile } from '@/utils/imageUpload'

type SectionTableRow = Section & { gradeName: string; unitTitle: string; lessonTitle: string; quizCount: number }

export function SectionsPage() {
  const { gradeId, unitId, lessonId } = useParams<{ gradeId: string; unitId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshSections } = useCurriculumCache()
  
  // Get the current grade, unit, and lesson
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  const currentLesson = cachedAllLessons.find((l) => l.id === lessonId && l.gradeId === gradeId && l.unitId === unitId)
  
  const [sections, setSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Redirect if params are missing
  useEffect(() => {
    if (!gradeId) {
      navigate('/curriculum/grades')
      return
    }
    if (!unitId) {
      navigate(`/curriculum/${gradeId}/units`)
      return
    }
    if (!lessonId) {
      navigate(`/curriculum/${gradeId}/${unitId}/lessons`)
      return
    }
  }, [gradeId, unitId, lessonId, navigate])

  // Load sections for the lesson from URL (hierarchical)
  useEffect(() => {
    if (!gradeId || !unitId || !lessonId) {
      setIsLoading(false)
      setSections([])
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalSectionService.listen(
      gradeId,
      unitId,
      lessonId,
      (data) => {
        setSections(data)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [gradeId, unitId, lessonId])

  const form = useForm<SectionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(sectionSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      title: '',
      videoLink: '',
      lists: {
        items: [],
      },
    },
  })

  const listItemsFieldArray = useFieldArray({
    control: form.control,
    name: 'lists.items',
  })

  useEffect(() => {
    setPageTitle('Sections')
  }, [setPageTitle])

  useEffect(() => {
    if (editingSection) {
      form.reset({
        id: editingSection.id,
        gradeId: editingSection.gradeId,
        unitId: editingSection.unitId,
        lessonId: editingSection.lessonId,
        title: editingSection.title,
        videoLink: editingSection.videoLink || '',
        lists: editingSection.lists || { items: [] },
      })
    } else {
      form.reset({
        gradeId: gradeId || '',
        unitId: unitId || '',
        lessonId: lessonId || '',
        title: '',
        videoLink: '',
        lists: { items: [] },
      })
    }
  }, [editingSection, gradeId, unitId, lessonId, form])

  const rows = useMemo<SectionTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(cachedAllUnits.map((unit) => [unit.id, `Unit ${unit.number}`]))
    const lessonMap = new Map(cachedAllLessons.map((lesson) => [lesson.id, lesson.title]))
    const quizzesPerSection = cachedAllQuizzes.reduce<Record<string, number>>((acc, quiz) => {
      const key = `${quiz.gradeId}_${quiz.unitId}_${quiz.lessonId}_${quiz.sectionId}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    return sections
      .map((section) => ({
        ...section,
        gradeName: gradeMap.get(section.gradeId) ?? '—',
        unitTitle: unitMap.get(section.unitId) ?? '—',
        lessonTitle: lessonMap.get(section.lessonId) ?? '—',
        quizCount: quizzesPerSection[`${section.gradeId}_${section.unitId}_${section.lessonId}_${section.id}`] ?? 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [sections, grades, cachedAllUnits, cachedAllLessons, cachedAllQuizzes])

  const handleOpenNew = () => {
    setEditingSection(null)
    setIsModalOpen(true)
  }

  const handleEdit = (section: Section) => {
    setEditingSection(section)
    setIsModalOpen(true)
  }


  const handleDelete = async (section: Section) => {
    const confirmed = await confirmAction({
      title: 'Delete section?',
      description: `Are you sure you want to delete "${section.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!section.gradeId || !section.unitId || !section.lessonId) {
        notifyError('Invalid section', 'Section missing required IDs')
        return
      }
      await hierarchicalSectionService.remove(section.gradeId, section.unitId, section.lessonId, section.id)
      notifySuccess('Section deleted successfully')
      refreshSections() // Refresh cache
    } catch (error) {
      notifyError('Unable to delete section', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!values.gradeId || !values.unitId || !values.lessonId) {
        notifyError('Grade, Unit, and Lesson required', 'Please select all required fields')
        return
      }

      // Check for duplicate section title in the same grade + unit + lesson
      const duplicateSection = sections.find(
        (s) =>
          s.title.toLowerCase().trim() === values.title.toLowerCase().trim() &&
          s.gradeId === gradeId &&
          s.unitId === unitId &&
          s.lessonId === lessonId &&
          s.id !== editingSection?.id,
      )
      if (duplicateSection) {
        notifyError('Duplicate section', `A section with the title "${values.title}" already exists for this lesson.`)
        return
      }

      if (editingSection) {
        if (!editingSection.gradeId || !editingSection.unitId || !editingSection.lessonId) {
          notifyError('Invalid section', 'Section missing required IDs')
          return
        }
        // Prepare update data
        const trimmedVideoLink = values.videoLink?.trim()
        const updateData: Record<string, unknown> = {
          title: values.title,
        }
        // Only include videoLink if it has a value, otherwise use deleteField to remove it
        if (trimmedVideoLink && trimmedVideoLink.length > 0) {
          updateData.videoLink = trimmedVideoLink
        } else {
          // Use deleteField to remove the field from Firestore
          updateData.videoLink = deleteField()
        }
        // Handle lists
        if (values.lists && values.lists.items.length > 0) {
          updateData.lists = values.lists
        } else {
          updateData.lists = deleteField()
        }
        await hierarchicalSectionService.update(
          editingSection.gradeId,
          editingSection.unitId,
          editingSection.lessonId,
          editingSection.id,
          updateData as Partial<Omit<Section, 'id' | 'createdAt' | 'updatedAt'>>,
        )
        notifySuccess('Section updated successfully')
        refreshSections() // Refresh cache
      } else {
        if (!gradeId || !unitId || !lessonId) {
          notifyError('Missing IDs', 'Grade, Unit, and Lesson IDs are required')
          return
        }
        // Prepare create data - only include videoLink if it has a value
        const trimmedVideoLink = values.videoLink?.trim()
        const createData: Omit<Section, 'id' | 'createdAt' | 'updatedAt'> = {
          gradeId: gradeId,
          unitId: unitId,
          lessonId: lessonId,
          title: values.title,
        }
        // Only include videoLink if it has a value
        if (trimmedVideoLink && trimmedVideoLink.length > 0) {
          createData.videoLink = trimmedVideoLink
        }
        // Include lists if they exist
        if (values.lists && values.lists.items.length > 0) {
          createData.lists = values.lists
        }
        await hierarchicalSectionService.create(gradeId, unitId, lessonId, createData)
        notifySuccess('Section created successfully')
        refreshSections() // Refresh cache
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save section', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<SectionTableRow>> = [
    { 
      key: 'title', 
      header: 'Section Title',
      render: (row) => (
        <div className="whitespace-normal break-words" title={row.title}>
          {row.title}
        </div>
      ),
    },
    {
      key: 'quizCount',
      header: 'Quizzes',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.quizCount}</span>,
    },
    {
      key: 'videoLink',
      header: 'Video',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          {row.videoLink ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group"
              onClick={() => window.open(row.videoLink, '_blank', 'noopener,noreferrer')}
              title="Watch Video"
            >
              <Play className="h-4 w-4 text-primary group-hover:text-white" />
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      ),
    },
  ]

  // Show loader while data is loading
  if (cacheLoading || isLoading) {
    return <PageLoader />
  }

  // Show error only after loading is complete
  if (!gradeId || !unitId || !lessonId || !currentGrade || !currentUnit || !currentLesson) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Grade, Unit, or Lesson not found</p>
          <Button asChild variant="link" className="mt-2">
            <Link to="/curriculum/grades">Back to Grades</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground flex items-center gap-1.5 flex-wrap">
            <Link to="/curriculum" className="hover:text-primary transition-colors">
              {currentGrade.name}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link to={`/curriculum/${gradeId}/units`} className="hover:text-primary transition-colors">
              Unit {currentUnit.number}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link to={`/curriculum/${gradeId}/${unitId}/lessons`} className="hover:text-primary transition-colors">
              {currentLesson.title}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Sections</span>
          </h2>
          <p className="text-sm text-muted-foreground">Sections organize quiz experiences within each lesson.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Section
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No sections yet. Create a section to add quizzes for this lesson."
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={(section) => navigate(`/curriculum/${gradeId}/${unitId}/${lessonId}/${section.id}/quizzes`)}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSection ? 'Edit Section' : 'Add Section'}
        description="Sections define the quiz experience inside a lesson."
        onSubmit={onSubmit}
        submitLabel={editingSection ? 'Update Section' : 'Create Section'}
        isSubmitting={form.formState.isSubmitting}
      >
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Vocabulary Drill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="videoLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Video Link (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      {...field} 
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Add an educational video link that will be displayed to students.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lists Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <FormLabel>Lists (Optional)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => listItemsFieldArray.append({ english: '', arabic: '', imageUrl: '' })}
                >
                  Add List Item
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add vocabulary or sentence lists with English and Arabic translations. Images are optional.
              </p>

              {listItemsFieldArray.fields.map((fieldItem, index) => (
                <div key={fieldItem.id} className="space-y-4 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-semibold">List Item {index + 1}</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => listItemsFieldArray.remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {/* Image Upload Section - At Top */}
                    <FormField
                      name={`lists.items.${index}.imageUrl` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image (Optional)</FormLabel>
                          <div className="space-y-2">
                            {field.value ? (
                              <div className="relative group">
                                <img
                                  src={field.value}
                                  alt="Preview"
                                  className="w-full rounded-lg border-2 border-border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ maxHeight: '400px' }}
                                  onClick={() => setFullImageUrl(field.value)}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="bg-black/50 hover:bg-black/70 text-white border-0"
                                    onClick={() => setFullImageUrl(field.value)}
                                    title="View full image"
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="bg-red-500/90 hover:bg-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      field.onChange('')
                                    }}
                                    disabled={uploadingImageIndex === index}
                                    title="Remove image"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  if (uploadingImageIndex === index) return
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = 'image/*'
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0]
                                    if (file) {
                                      const validation = validateImageFile(file)
                                      if (!validation.isValid) {
                                        notifyError('Invalid image', validation.error)
                                        return
                                      }
                                      try {
                                        setUploadingImageIndex(index)
                                        // Check if user is authenticated
                                        if (!user?.uid) {
                                          throw new Error('You must be logged in to upload images. Please refresh the page.')
                                        }
                                        
                                        const url = await uploadImageToStorage(file)
                                        field.onChange(url)
                                        setUploadingImageIndex(null)
                                        notifySuccess('Image uploaded successfully')
                                      } catch (error) {
                                        setUploadingImageIndex(null)
                                        const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
                                        notifyError('Upload failed', errorMessage)
                                        console.error('Image upload error details:', {
                                          error,
                                          user: user?.uid,
                                          fileName: file.name,
                                          fileSize: file.size,
                                        })
                                      }
                                    }
                                  }
                                  input.click()
                                }}
                                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${
                                  uploadingImageIndex === index
                                    ? 'border-primary bg-primary/5 cursor-wait'
                                    : 'border-border bg-muted/30 cursor-pointer hover:border-primary'
                                }`}
                              >
                                {uploadingImageIndex === index ? (
                                  <>
                                    <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
                                    <p className="text-sm font-medium text-primary">
                                      Uploading image...
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Please wait
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Click to upload image
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      PNG, JPG, GIF up to 5MB
                                    </p>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* English Input */}
                    <FormField
                      name={`lists.items.${index}.english` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>English</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter English text" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Arabic Input */}
                    <FormField
                      name={`lists.items.${index}.arabic` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Arabic</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Arabic text" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}

              {listItemsFieldArray.fields.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  No list items added. Click "Add List Item" to create one.
                </p>
              )}
            </div>
          </form>
        </Form>
      </FormModal>

      {/* Full Image View Dialog */}
      <Dialog open={!!fullImageUrl} onOpenChange={(open) => !open && setFullImageUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {fullImageUrl && (
            <div className="relative">
              <img
                src={fullImageUrl}
                alt="Full size preview"
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setFullImageUrl(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


