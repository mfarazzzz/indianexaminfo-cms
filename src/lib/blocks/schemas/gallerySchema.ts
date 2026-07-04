import { z } from 'zod'
export const GalleryImageSchema = z.object({
  url:     z.string().url(),
  alt:     z.string(),
  caption: z.string().optional(),
})
export const GallerySchema = z.object({
  type:   z.literal('gallery'),
  images: z.array(GalleryImageSchema),
})
export type GalleryContent = z.infer<typeof GallerySchema>
export const galleryDefault: GalleryContent = { type: 'gallery', images: [] }
