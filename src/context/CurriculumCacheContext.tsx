import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { gradeService } from '@/services/firebase'
import { hierarchicalUnitService, hierarchicalLessonService, hierarchicalSectionService } from '@/services/hierarchicalServices'
import { getQuizzesForSection } from '@/services/quizBuilderService'
import { useCollection } from '@/hooks/useCollection'
import type { Grade, Unit, Lesson, Section, Quiz } from '@/types/models'

type CurriculumCache = {
  grades: Grade[]
  allUnits: Unit[]
  allLessons: Lesson[]
  allSections: Section[]
  allQuizzes: Quiz[]
  isLoading: boolean
  refreshUnits: () => void
  refreshLessons: () => void
  refreshSections: () => void
  refreshQuizzes: () => void
}

const CurriculumCacheContext = createContext<CurriculumCache | undefined>(undefined)

export function CurriculumCacheProvider({ children }: { children: ReactNode }) {
  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const [allUnits, setAllUnits] = useState<Unit[]>([])
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unitsCacheKey, setUnitsCacheKey] = useState(0)
  const [lessonsCacheKey, setLessonsCacheKey] = useState(0)
  const [sectionsCacheKey, setSectionsCacheKey] = useState(0)
  const [quizzesCacheKey, setQuizzesCacheKey] = useState(0)

  // Load all units when grades change
  useEffect(() => {
    if (grades.length === 0) {
      setAllUnits([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const loadAllUnits = async () => {
      try {
        const unitsPromises = grades.map((grade) => hierarchicalUnitService.getAll(grade.id))
        const unitsArrays = await Promise.all(unitsPromises)
        setAllUnits(unitsArrays.flat())
      } catch (error) {
        console.error('Failed to load units:', error)
        setAllUnits([])
      } finally {
        setIsLoading(false)
      }
    }

    loadAllUnits()
  }, [grades, unitsCacheKey])

  // Load all lessons when units change
  useEffect(() => {
    if (allUnits.length === 0) {
      setAllLessons([])
      return
    }

    const loadAllLessons = async () => {
      try {
        const lessonsPromises = allUnits.map((unit) =>
          hierarchicalLessonService.getAll(unit.gradeId, unit.id).catch(() => []),
        )
        const lessonsArrays = await Promise.all(lessonsPromises)
        setAllLessons(lessonsArrays.flat())
      } catch (error) {
        console.error('Failed to load lessons:', error)
        setAllLessons([])
      }
    }

    loadAllLessons()
  }, [allUnits, lessonsCacheKey])

  // Load all sections when lessons change
  useEffect(() => {
    if (allLessons.length === 0) {
      setAllSections([])
      return
    }

    const loadAllSections = async () => {
      try {
        const sectionsPromises = allLessons.map((lesson) =>
          hierarchicalSectionService.getAll(lesson.gradeId, lesson.unitId, lesson.id).catch(() => []),
        )
        const sectionsArrays = await Promise.all(sectionsPromises)
        setAllSections(sectionsArrays.flat())
      } catch (error) {
        console.error('Failed to load sections:', error)
        setAllSections([])
      }
    }

    loadAllSections()
  }, [allLessons, sectionsCacheKey])

  // Load all quizzes when sections change
  useEffect(() => {
    if (allSections.length === 0) {
      setAllQuizzes([])
      return
    }

    const loadAllQuizzes = async () => {
      try {
        const quizPromises = allSections.map((section) =>
          getQuizzesForSection(section.gradeId, section.unitId, section.lessonId, section.id).catch(() => []),
        )
        const quizArrays = await Promise.all(quizPromises)
        setAllQuizzes(quizArrays.flat())
      } catch (error) {
        console.error('Failed to load quizzes:', error)
        setAllQuizzes([])
      }
    }

    loadAllQuizzes()
  }, [allSections, quizzesCacheKey])

  const refreshUnits = () => setUnitsCacheKey((prev) => prev + 1)
  const refreshLessons = () => setLessonsCacheKey((prev) => prev + 1)
  const refreshSections = () => setSectionsCacheKey((prev) => prev + 1)
  const refreshQuizzes = () => setQuizzesCacheKey((prev) => prev + 1)

  return (
    <CurriculumCacheContext.Provider
      value={{
        grades,
        allUnits,
        allLessons,
        allSections,
        allQuizzes,
        isLoading,
        refreshUnits,
        refreshLessons,
        refreshSections,
        refreshQuizzes,
      }}
    >
      {children}
    </CurriculumCacheContext.Provider>
  )
}

export function useCurriculumCache() {
  const context = useContext(CurriculumCacheContext)
  if (!context) {
    throw new Error('useCurriculumCache must be used within CurriculumCacheProvider')
  }
  return context
}

