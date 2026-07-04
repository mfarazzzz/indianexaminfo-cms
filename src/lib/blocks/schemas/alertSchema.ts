import { z } from 'zod'
export const AlertSchema = z.object({
  type:    z.literal('alert_box'),
  variant: z.enum(['info', 'warning', 'error', 'success']),
  title:   z.string(),
  body:    z.string(),
})
export type AlertContent = z.infer<typeof AlertSchema>
export const alertDefault: AlertContent = { type: 'alert_box', variant: 'info', title: '', body: '' }
