import { useCallback, useEffect, useState } from 'react'
import type { QueryConstraint } from 'firebase/firestore'

type Listener<T> = (callback: (items: T[]) => void, constraints?: QueryConstraint[]) => () => void

export function useCollection<T>(listener: Listener<T>, constraints?: QueryConstraint[]) {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    setIsLoading(true)
    const unsubscribe = listener(
      (items) => {
        setData(items)
        setIsLoading(false)
      },
      constraints,
    )
    return () => unsubscribe()
    // listener/constraints must be stable (e.g. gradeService.listen) to avoid repeated subscriptions
  }, [listener, constraints, refreshKey])

  return { data, isLoading, refetch }
}


