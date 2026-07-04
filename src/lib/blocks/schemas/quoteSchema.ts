import { z } from 'zod'
export const QuoteSchema = z.object({
  type:        z.literal('quote'),
  text:        z.string(),
  attribution: z.string().optional(),
})
export type QuoteContent = z.infer<typeof QuoteSchema>
export const quoteDefault: QuoteContent = { type: 'quote', text: '' }
