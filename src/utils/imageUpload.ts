// Using Cloudinary for image uploads (no CORS issues, easy setup)
import { uploadImageToCloudinary, validateImageFile as validateCloudinaryImage } from './cloudinaryUpload'

// Alternative options (commented out):
// Option 2: Firebase Storage
// import { uploadFile } from '@/services/firebase'
// import { firebaseAuth } from '@/services/firebase'

// Option 3: Base64 encoding
// import { compressAndConvertToBase64 } from './base64Upload'

/**
 * Upload an image file to Firebase Storage
 * @param file - The image file to upload
 * @param path - Optional custom path (defaults to 'sections/lists/{timestamp}_{filename}')
 * @returns Promise resolving to the download URL
 */
export async function uploadImageToStorage(
  file: File,
  path?: string,
): Promise<string> {
  try {
    // Using Cloudinary for image uploads
    // path parameter is ignored for Cloudinary (uses folder instead)
    const folder = path ? path.split('/').slice(0, -1).join('/') : 'sections/lists'
    return await uploadImageToCloudinary(file, folder)

    // Alternative: Firebase Storage (commented out)
    // const currentUser = firebaseAuth.currentUser
    // if (!currentUser) {
    //   throw new Error('You must be logged in to upload images.')
    // }
    // const storagePath = path || `sections/lists/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    // const result = await uploadFile(storagePath, file)
    // return result.url

    // Alternative: Base64 encoding (commented out)
    // return await compressAndConvertToBase64(file, 800, 0.8)
  } catch (error: any) {
    console.error('Error uploading image:', error)
    
    // Provide specific error messages
    if (error instanceof Error) {
      // Cloudinary specific errors
      if (error.message.includes('cloud name') || error.message.includes('not configured')) {
        throw new Error('Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in .env file.')
      }
      throw new Error(`Failed to upload image: ${error.message}`)
    }
    
    throw new Error('Failed to upload image. Please try again.')
  }
}

/**
 * Validate image file
 * @param file - The file to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Use Cloudinary validation (same validation logic)
  return validateCloudinaryImage(file)
}

