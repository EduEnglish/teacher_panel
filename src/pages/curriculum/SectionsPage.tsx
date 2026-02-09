import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Play, Upload, X, Loader2, Maximize2, Languages } from 'lucide-react'
import { deleteField } from 'firebase/firestore'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { translateToArabic } from '@/services/translationService'

type SectionTableRow = Section & { gradeName: string; unitTitle: string; lessonTitle: string; quizCount: number; serialNumber: number }

export function SectionsPage() {
  const { gradeId, unitId, lessonId } = useParams<{ gradeId: string; unitId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null)
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshSections } = useCurriculumCache()
  
  // Get the current grade, unit, and lesson
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  const currentLesson = cachedAllLessons.find((l) => l.id === lessonId && l.gradeId === gradeId && l.unitId === unitId)
  
  const [sections, setSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

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

    const getCreatedAtMillis = (section: Section) => {
      const ts = section.createdAt as { toMillis?: () => number } | null | undefined
      return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
    }

    const baseRows = sections
      .map((section) => ({
        ...section,
        gradeName: gradeMap.get(section.gradeId) ?? '—',
        unitTitle: unitMap.get(section.unitId) ?? '—',
        lessonTitle: lessonMap.get(section.lessonId) ?? '—',
        quizCount: quizzesPerSection[`${section.gradeId}_${section.unitId}_${section.lessonId}_${section.id}`] ?? 0,
      }))
      .sort((a, b) => {
        // Primary: latest created first
        const aCreated = getCreatedAtMillis(a)
        const bCreated = getCreatedAtMillis(b)
        if (aCreated !== bCreated) {
          return bCreated - aCreated
        }
        // Fallback: alphabetical by title
        return a.title.localeCompare(b.title)
      })

    return baseRows.map((row, index) => ({
      ...row,
      serialNumber: index + 1,
    }))
  }, [sections, grades, cachedAllUnits, cachedAllLessons, cachedAllQuizzes])

  const handleOpenNew = () => {
    setEditingSection(null)
    setIsModalOpen(true)
  }

  const handleEdit = (section: Section) => {
    setEditingSection(section)
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
    setEditingSection(null)
    // Reset form to default values to clear any incomplete list items
    form.reset({
      gradeId: gradeId || '',
      unitId: unitId || '',
      lessonId: lessonId || '',
      title: '',
      videoLink: '',
      lists: { items: [] },
    })
    // Reset form validation state
    form.clearErrors()
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

  // Handler function that does the actual submission
  const handleSubmitData = async (values: SectionFormValues) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    
    try {
      if (!values.gradeId || !values.unitId || !values.lessonId) {
        notifyError('Grade, Unit, and Lesson required', 'Please select all required fields')
        return
      }

      // Filter out empty/incomplete list items (items without both english and arabic)
      // Also clean up undefined values - Firebase doesn't accept undefined
      const filteredListItems = values.lists?.items
        ?.filter((item) => item.english?.trim() && item.arabic?.trim())
        ?.map((item) => {
          // Remove undefined fields - only include defined values
          const cleanedItem: { english: string; arabic: string; imageUrl?: string; pronunciation?: string } = {
            english: item.english.trim(),
            arabic: item.arabic.trim(),
          }
          // Only include imageUrl if it's a non-empty string
          if (item.imageUrl && item.imageUrl.trim()) {
            cleanedItem.imageUrl = item.imageUrl.trim()
          }
          // Only include pronunciation if it's a non-empty string
          if (item.pronunciation && item.pronunciation.trim()) {
            cleanedItem.pronunciation = item.pronunciation.trim()
          }
          return cleanedItem
        }) || []

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
        // Handle lists - use filtered items
        if (filteredListItems.length > 0) {
          updateData.lists = { items: filteredListItems }
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
        
        // Close modal and reset form
        handleClose()
        
        // Only show notification if component is still mounted
        if (isMountedRef.current) {
          notifySuccess('Section updated successfully')
          refreshSections() // Refresh cache
        }
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
        // Include lists if they exist - use filtered items
        if (filteredListItems.length > 0) {
          createData.lists = { items: filteredListItems }
        }
        await hierarchicalSectionService.create(gradeId, unitId, lessonId, createData)
        
        // Close modal and reset form
        handleClose()
        
        // Only show notification if component is still mounted
        if (isMountedRef.current) {
          notifySuccess('Section created successfully')
          refreshSections() // Refresh cache
        }
      }
    } catch (error) {
      // Only show error if component is still mounted
      if (isMountedRef.current) {
        notifyError('Unable to save section', error instanceof Error ? error.message : undefined)
      }
      console.error('Section save error:', error)
    }
  }

  // Wrapper that filters empty list items before validation, then uses handleSubmit for proper form state
  const onSubmit = async () => {
    // Get current form values
    const rawValues = form.getValues()
    
    // Filter out empty/incomplete list items BEFORE validation
    // Also clean up undefined values - Firebase doesn't accept undefined
    const filteredListItems = rawValues.lists?.items
      ?.filter((item) => item.english?.trim() && item.arabic?.trim())
      ?.map((item) => {
        // Remove undefined fields - only include defined values
        const cleanedItem: { english: string; arabic: string; imageUrl?: string; pronunciation?: string } = {
          english: item.english.trim(),
          arabic: item.arabic.trim(),
        }
        // Only include imageUrl if it's a non-empty string
        if (item.imageUrl && item.imageUrl.trim()) {
          cleanedItem.imageUrl = item.imageUrl.trim()
        }
        // Only include pronunciation if it's a non-empty string
        if (item.pronunciation && item.pronunciation.trim()) {
          cleanedItem.pronunciation = item.pronunciation.trim()
        }
        return cleanedItem
      }) || []

    // Update form with filtered list items before validation
    form.setValue('lists.items', filteredListItems, { shouldValidate: false })
    
    // Now use handleSubmit to validate and submit (this ensures isSubmitting state works correctly)
    form.handleSubmit(handleSubmitData)()
  }

  // Manual translate function - called when user clicks translate button
  const handleManualTranslate = useCallback(async (index: number) => {
    const englishValue = form.getValues(`lists.items.${index}.english`) as string
    
    if (!englishValue || !englishValue.trim()) {
      notifyError('No text to translate', 'Please enter English text first.')
      return
    }

    // Set translating state
    setTranslatingIndex(index)

    try {
      const result = await translateToArabic(englishValue.trim())
      
      if (result.success && result.translatedText) {
        // Fill Arabic field with translation (but keep it editable)
        form.setValue(`lists.items.${index}.arabic`, result.translatedText, { shouldValidate: false })
        notifySuccess('Translation completed', 'Arabic text has been auto-filled. You can edit it if needed.')
      } else if (result.error) {
        // Show error notification
        notifyError('Translation failed', result.error)
      }
    } catch (error) {
      console.error('Translation error:', error)
      notifyError('Translation failed', 'Unable to translate. Please enter Arabic manually.')
    } finally {
      setTranslatingIndex(null)
    }
  }, [form, notifyError, notifySuccess])

  // Open dialog to edit existing item
  const openEditItemDialog = (index: number) => {
    setEditingItemIndex(index)
    setIsItemDialogOpen(true)
  }

  // Open dialog to add new item
  const openAddItemDialog = () => {
    const newIndex = listItemsFieldArray.fields.length
    listItemsFieldArray.append({ english: '', arabic: '', imageUrl: '', pronunciation: '' })
    // Explicitly set form values to ensure fields are registered
    form.setValue(`lists.items.${newIndex}.english`, '', { shouldValidate: false })
    form.setValue(`lists.items.${newIndex}.arabic`, '', { shouldValidate: false })
    form.setValue(`lists.items.${newIndex}.imageUrl`, '', { shouldValidate: false })
    form.setValue(`lists.items.${newIndex}.pronunciation`, '', { shouldValidate: false })
    // Use setTimeout to ensure form field is registered before opening dialog
    setTimeout(() => {
      setEditingItemIndex(newIndex)
      setIsItemDialogOpen(true)
    }, 0)
  }

  // Close item dialog
  const closeItemDialog = () => {
    // If editing item index is the last one and it's empty, remove it (cancel add)
    if (editingItemIndex !== null) {
      const item = form.watch(`lists.items.${editingItemIndex}`)
      if (!item?.english?.trim() && !item?.arabic?.trim() && !item?.imageUrl && !item?.pronunciation?.trim()) {
        listItemsFieldArray.remove(editingItemIndex)
      }
    }
    setIsItemDialogOpen(false)
    setEditingItemIndex(null)
    setTranslatingIndex(null)
  }

  // Save and close item dialog
  const saveItemDialog = () => {
    setIsItemDialogOpen(false)
    setEditingItemIndex(null)
    setTranslatingIndex(null)
  }

  const columns: Array<DataTableColumn<SectionTableRow>> = [
    {
      key: 'serialNumber',
      header: 'S.No.',
      width: '64px',
      align: 'center',
      render: (row) => <span className="text-xs text-muted-foreground">{row.serialNumber}</span>,
    },
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
        onClose={handleClose}
        title={editingSection ? 'Edit Section' : 'Add Section'}
        description="Sections define the quiz experience inside a lesson."
        onSubmit={onSubmit}
        submitLabel={editingSection ? 'Update Section' : 'Create Section'}
        isSubmitting={form.formState.isSubmitting}
        className="max-w-7xl max-h-[90vh] overflow-y-auto"
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

            {/* Lists Section - Grid Card View */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <FormLabel>Lists (Optional)</FormLabel>
                  <p className="text-xs font-medium" style={{ color: '#ea580c' }}>
                    Total Items: {listItemsFieldArray.fields.length}
                  </p>
                </div>
              </div>

              {/* Grid of List Item Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {listItemsFieldArray.fields.map((fieldItem, index) => {
                  const item = form.watch(`lists.items.${index}`)
                  return (
                    <div
                      key={fieldItem.id}
                      className="group relative border border-border rounded-lg overflow-hidden bg-card hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col"
                      style={{ height: '200px' }}
                    >
                      {/* Image Thumbnail */}
                      {item?.imageUrl ? (
                        <div className="relative h-16 bg-muted flex-shrink-0">
                          <img
                            src={item.imageUrl}
                            alt="Item preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div className="relative h-16 bg-muted/30 flex-shrink-0" />
                      )}

                      {/* Card Content */}
                      <div className="p-2 space-y-0.8 flex flex-col flex-grow min-h-0">
                        {/* English Text */}
                        <div className="h-7 flex-shrink-0 flex items-center overflow-hidden">
                          <p className="text-sm font-medium text-foreground truncate w-full" title={item?.english || ''}>
                            {item?.english || <span className="text-muted-foreground italic">No English text</span>}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border/50 flex-shrink-0" />

                        {/* Arabic Text */}
                        <div className="h-10 flex-shrink-0 flex items-center overflow-hidden">
                          <p className="text-sm text-muted-foreground truncate w-full" dir="rtl" title={item?.arabic || ''}>
                            {item?.arabic || <span className="italic">No Arabic text</span>}
                          </p>
                        </div>

                        {/* Spacer to push buttons to bottom */}
                        {/* <div className="flex-grow" style={{ minHeight: '8px' }} /> */}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-shrink-0" style={{ minHeight: '36px' }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => openEditItemDialog(index)}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              listItemsFieldArray.remove(index)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Add New Item Card */}
                <button
                  type="button"
                  onClick={openAddItemDialog}
                  className="group relative border-2 border-dashed rounded-lg overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-200/50 hover:border-orange-400 transition-all flex flex-col items-center justify-center gap-3"
                  style={{ borderColor: '#fed7aa', height: '200px' }}
                >
                  <div className="w-16 h-16 rounded-full bg-orange-200/50 group-hover:bg-orange-300/50 flex items-center justify-center transition-colors">
                    <span className="text-3xl text-orange-600 group-hover:text-orange-700">+</span>
                  </div>
                  <p className="text-sm font-medium text-orange-700 group-hover:text-orange-800">Add New Item</p>
                  <p className="text-xs text-orange-600/70">Click to create</p>
                </button>
              </div>

              {listItemsFieldArray.fields.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-8">
                  No list items added yet. Click "Add New Item" to create one.
                </p>
              )}
            </div>
          </form>
        </Form>
      </FormModal>

      {/* Edit List Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={(value) => {
        // Only allow closing via close button
        // Outside clicks and escape are prevented by preventCloseOnOutsideClick and preventCloseOnEscape
        if (!value) {
          closeItemDialog()
        }
      }}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          preventCloseOnOutsideClick={true}
          preventCloseOnEscape={true}
        >
          <DialogHeader>
            <DialogTitle>
              {editingItemIndex !== null && editingItemIndex < listItemsFieldArray.fields.length 
                ? `Edit List Item ${editingItemIndex + 1}`
                : 'Add New List Item'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <div className="space-y-6 py-4">

              {editingItemIndex !== null && editingItemIndex < listItemsFieldArray.fields.length && (
                <div className="space-y-6">
                {/* Image Upload Section */}
                <FormField
                  name={`lists.items.${editingItemIndex}.imageUrl` as const}
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
                              style={{ maxHeight: '300px' }}
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
                                disabled={uploadingImageIndex === editingItemIndex}
                                title="Remove image"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              if (uploadingImageIndex === editingItemIndex) return
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
                                    setUploadingImageIndex(editingItemIndex)
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
                                  }
                                }
                              }
                              input.click()
                            }}
                            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${
                              uploadingImageIndex === editingItemIndex
                                ? 'border-primary bg-primary/5 cursor-wait'
                                : 'border-border bg-muted/30 cursor-pointer hover:border-primary'
                            }`}
                          >
                            {uploadingImageIndex === editingItemIndex ? (
                              <>
                                <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
                                <p className="text-sm font-medium text-primary">Uploading image...</p>
                                <p className="text-xs text-muted-foreground mt-1">Please wait</p>
                              </>
                            ) : (
                              <>
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">Click to upload image</p>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
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
                  name={`lists.items.${editingItemIndex}.english` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>English</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter English text" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pronunciation Input (Optional) */}
                <FormField
                  name={`lists.items.${editingItemIndex}.pronunciation` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <span>Pronunciation Guide (Optional)</span>
                        <span className="text-xs font-normal text-muted-foreground">🔊 TTS Only</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder='e.g., "reed" for "read" (present tense)' 
                          {...field}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Arabic Input */}
                <FormField
                  name={`lists.items.${editingItemIndex}.arabic` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>Arabic</span>
                          {translatingIndex === editingItemIndex && (
                            <span className="inline-flex items-center gap-1 text-xs font-normal text-primary">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Translating...
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualTranslate(editingItemIndex)}
                          disabled={translatingIndex === editingItemIndex || !form.getValues(`lists.items.${editingItemIndex}.english`)?.trim()}
                          className="h-7 px-3 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 hover:text-orange-800"
                        >
                          <Languages className="h-3 w-3 mr-1.5" />
                          Translate
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter Arabic translation or click Translate button" 
                          {...field}
                          dir="rtl"
                          disabled={translatingIndex === editingItemIndex}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeItemDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={saveItemDialog}
                    className="bg-primary"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
            </div>
          </Form>
        </DialogContent>
      </Dialog>

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


