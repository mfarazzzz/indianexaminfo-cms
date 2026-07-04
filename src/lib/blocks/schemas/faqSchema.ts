import { z } from 'zod'
export const FAQItemSchema = z.object({
  q: z.string(),
  a: z.string(),
})
export const FAQSchema = z.object({
  type: z.literal('faq'),
  faqs: z.array(FAQItemSchema),
})
export type FAQContent = z.infer<typeof FAQSchema>
export const faqDefault: FAQContent = { type: 'faq', faqs: [] }
