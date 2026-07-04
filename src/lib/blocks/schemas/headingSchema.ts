import { z } from 'zod'
export const HeadingSchema = z.object({
  type:  z.literal('heading'),
  level: z.number().int().min(1).max(6),
  text:  z.string(),
})
export type HeadingContent = z.infer<typeof HeadingSchema>
export const headingDefault: HeadingContent = { type: 'heading', level: 2, text: '' }
