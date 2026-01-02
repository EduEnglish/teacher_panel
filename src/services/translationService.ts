/**
 * Translation Service
 * Auto-translates English text to Arabic using free translation APIs
 */

// Using MyMemory Translation API (free, no key required for basic usage)
// With email parameter, limit increases from 5,000 to 50,000 characters/day
const TRANSLATION_API_URL = import.meta.env.VITE_TRANSLATION_API_URL
// Email for registered user tier (50,000 chars/day instead of 5,000)
const TRANSLATION_EMAIL = import.meta.env.VITE_TRANSLATION_EMAIL

export interface TranslationResult {
  success: boolean
  translatedText: string
  error?: string
}

/**
 * Translates English text to Arabic
 * @param englishText - The English text to translate
 * @returns TranslationResult with translated text or error
 */
export async function translateToArabic(englishText: string): Promise<TranslationResult> {
  try {
    const trimmedText = englishText.trim()
    
    // Return empty if input is empty
    if (!trimmedText) {
      return {
        success: true,
        translatedText: '',
      }
    }

    // Create URL with parameters
    // 'de' parameter with email increases limit from 5,000 to 50,000 chars/day
    const params = new URLSearchParams({
      q: trimmedText,
      langpair: 'en|ar', // English to Arabic
      de: TRANSLATION_EMAIL, // Email for registered user tier (50k chars/day)
    })

    const response = await fetch(`${TRANSLATION_API_URL}?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error(`Translation API returned ${response.status}`)
    }

    const data = await response.json()

    // Check if translation was successful
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return {
        success: true,
        translatedText: data.responseData.translatedText,
      }
    }

    // If API limit exceeded or other error
    if (data.responseStatus === 403) {
      return {
        success: false,
        translatedText: '',
        error: 'Translation limit exceeded. Please try again later or enter Arabic manually.',
      }
    }

    throw new Error(data.responseDetails || 'Translation failed')
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      translatedText: '',
      error: error instanceof Error ? error.message : 'Translation service unavailable',
    }
  }
}

/**
 * Debounced translation function
 * Returns a promise that resolves after delay if text hasn't changed
 */
export function createDebouncedTranslation(delay: number = 800) {
  let timeoutId: number | null = null

  return function debouncedTranslate(englishText: string): Promise<TranslationResult> {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(async () => {
        const result = await translateToArabic(englishText)
        resolve(result)
      }, delay)
    })
  }
}

