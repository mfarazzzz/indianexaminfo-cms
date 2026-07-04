import { z } from 'zod'
export const RichTextSchema = z.object({
  type: z.literal('rich_text'),
  html: z.string(),
})
export type RichTextContent = z.infer<typeof RichTextSchema>
export const richTextDefault: RichTextContent = { type: 'rich_text', html: '' }
