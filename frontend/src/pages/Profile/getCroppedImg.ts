import type { Crop } from 'react-image-crop'
import { convertToPixelCrop } from 'react-image-crop'

/**
 * Returns a blob for the cropped area of the image.
 * Uses the same logic as react-image-crop demos: crop is in display coordinates,
 * we scale to natural image size and draw to canvas.
 */
export function getCroppedImg(image: HTMLImageElement, crop: Crop): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const pixelCrop = crop.unit === 'px'
      ? crop
      : convertToPixelCrop(crop, image.width, image.height)
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(pixelCrop.width * scaleX)
    canvas.height = Math.floor(pixelCrop.height * scaleY)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }
    ctx.drawImage(
      image,
      Math.floor(pixelCrop.x * scaleX),
      Math.floor(pixelCrop.y * scaleY),
      Math.floor(pixelCrop.width * scaleX),
      Math.floor(pixelCrop.height * scaleY),
      0,
      0,
      canvas.width,
      canvas.height
    )
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.9
    )
  })
}
