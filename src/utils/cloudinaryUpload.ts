/**
 * Cloudinary Image Upload Utility
 * 
 * Setup Instructions:
 * 1. Sign up at https://cloudinary.com (free tier available)
 * 2. Get your Cloud Name, API Key, and API Secret from dashboard
 * 3. Add to .env file:
 *    VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *    VITE_CLOUDINARY_API_KEY=your_api_key
 *    VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset (optional, for unsigned uploads)
 * 
 * For unsigned uploads (recommended for client-side):
 * 1. Go to Cloudinary Dashboard → Settings → Upload
 * 2. Create an "Upload Preset" with "Unsigned" mode
 * 3. Use that preset name in VITE_CLOUDINARY_UPLOAD_PRESET
 */

interface CloudinaryUploadResponse {
  public_id: string
  secure_url: string
  url: string
  width: number
  height: number
  format: string
  bytes: number
}

/**
 * Upload image to Cloudinary
 * @param file - The image file to upload
 * @param folder - Optional folder path in Cloudinary (defaults to 'sections/lists')
 * @returns Promise resolving to the secure URL
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: string = 'sections/lists',
): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in .env')
  }

  // Validate file
  const validation = validateImageFile(file)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  try {
    // Create form data
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset || 'ml_default') // Use preset or default
    formData.append('folder', folder)
    // Note: Transformations should be configured in the upload preset for unsigned uploads
    // Or can be applied via URL transformations when displaying the image

    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`)
    }

    const data: CloudinaryUploadResponse = await response.json()
    return data.secure_url // Use secure_url (HTTPS)
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload image to Cloudinary')
  }
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.',
    }
  }

  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Please upload an image smaller than 5MB.',
    }
  }

  return { isValid: true }
}

