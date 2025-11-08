import { useEffect, useState } from 'react'
import type { QueryConstraint } from 'firebase/firestore'

type Listener<T> = (callback: (items: T[]) => void, constraints?: QueryConstraint[]) => () => void

export function useCollection<T>(listener: Listener<T>, constraints?: QueryConstraint[]) {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
  }, [listener, constraints])

  return { data, isLoading }
}


