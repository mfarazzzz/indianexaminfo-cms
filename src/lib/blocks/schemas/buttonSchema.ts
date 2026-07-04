import { z } from 'zod'
export const ButtonSchema = z.object({
  type:  z.literal('button'),
  text:  z.string(),
  url:   z.string().url(),
  style: z.enum(['primary', 'secondary', 'outline']),
})
export type ButtonContent = z.infer<typeof ButtonSchema>
export const buttonDefault: ButtonContent = { type: 'button', text: 'Click here', url: 'https://example.com', style: 'primary' }
