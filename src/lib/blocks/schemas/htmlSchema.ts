import { z } from 'zod'
export const HTMLSchema = z.object({
  type: z.literal('html'),
  raw:  z.string(),
})
export type HTMLContent = z.infer<typeof HTMLSchema>
export const htmlDefault: HTMLContent = { type: 'html', raw: '' }
