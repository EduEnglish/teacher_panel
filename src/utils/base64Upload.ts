/**
 * Base64 Image Upload Utility
 * 
 * Stores images as base64 strings directly in Firestore.
 * 
 * Pros:
 * - No external service needed
 * - Simple implementation
 * - Works immediately
 * 
 * Cons:
 * - Limited by Firestore 1MB document size limit
 * - No image optimization
 * - Larger data transfer
 * - Not recommended for images > 500KB
 */

/**
 * Convert image file to base64 string
 * @param file - The image file to convert
 * @param maxSizeKB - Maximum size in KB (default: 500KB to stay under Firestore limit)
 * @returns Promise resolving to base64 data URL
 */
export async function convertImageToBase64(
  file: File,
  maxSizeKB: number = 500,
): Promise<string> {
  // Validate file
  const validation = validateImageFile(file, maxSizeKB)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read image file'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * Compress image before converting to base64
 * @param file - The image file
 * @param maxWidth - Maximum width (default: 800px)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Promise resolving to base64 data URL
 */
export async function compressAndConvertToBase64(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }
            
            const reader2 = new FileReader()
            reader2.onload = () => resolve(reader2.result as string)
            reader2.onerror = () => reject(new Error('Failed to convert compressed image'))
            reader2.readAsDataURL(blob)
          },
          'image/jpeg',
          quality
        )
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Validate image file
 */
export function validateImageFile(file: File, maxSizeKB: number = 500): { isValid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.',
    }
  }

  const maxSize = maxSizeKB * 1024 // Convert KB to bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size too large. Please upload an image smaller than ${maxSizeKB}KB.`,
    }
  }

  return { isValid: true }
}

