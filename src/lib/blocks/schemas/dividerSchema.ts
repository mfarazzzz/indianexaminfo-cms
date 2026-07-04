import { z } from 'zod'
export const DividerSchema = z.object({
  type:  z.literal('divider'),
  style: z.enum(['line', 'space']),
})
export type DividerContent = z.infer<typeof DividerSchema>
export const dividerDefault: DividerContent = { type: 'divider', style: 'line' }
