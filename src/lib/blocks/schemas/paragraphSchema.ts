import { z } from 'zod'
export const ParagraphSchema = z.object({
  type: z.literal('paragraph'),
  html: z.string(),
})
export type ParagraphContent = z.infer<typeof ParagraphSchema>
export const paragraphDefault: ParagraphContent = { type: 'paragraph', html: '' }
