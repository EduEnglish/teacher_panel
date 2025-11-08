import { format, parseISO } from 'date-fns'
import type { Timestamp } from 'firebase/firestore'

export function formatPercentage(value: number | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%'
  }
  return `${Number(value).toFixed(fractionDigits)}%`
}

export function formatDate(value?: Timestamp | string | null, defaultText = '—') {
  if (!value) return defaultText
  try {
    if (typeof value === 'string') {
      return format(parseISO(value), 'PP')
    }
    return format(value.toDate(), 'PP')
  } catch (error) {
    console.error('Failed to format date', error)
    return defaultText
  }
}

export function getInitials(name?: string) {
  if (!name) return 'EE'
  const segments = name.trim().split(' ').filter(Boolean)
  if (!segments.length) return 'EE'
  if (segments.length === 1) return segments[0]!.slice(0, 2).toUpperCase()
  return (segments[0]![0]! + segments[segments.length - 1]![0]!).toUpperCase()
}


