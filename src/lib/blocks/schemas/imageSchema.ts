import { z } from 'zod'
export const ImageSchema = z.object({
  type:    z.literal('image'),
  url:     z.string().url(),
  alt:     z.string(),
  caption: z.string().optional(),
})
export type ImageContent = z.infer<typeof ImageSchema>
export const imageDefault: ImageContent = { type: 'image', url: 'https://placeholder.com/image.jpg', alt: '' }
