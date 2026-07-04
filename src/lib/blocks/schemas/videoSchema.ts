import { z } from 'zod'
export const VideoSchema = z.object({
  type:     z.literal('video'),
  url:      z.string().url(),
  provider: z.enum(['youtube', 'vimeo', 'direct']),
  caption:  z.string().optional(),
})
export type VideoContent = z.infer<typeof VideoSchema>
export const videoDefault: VideoContent = { type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', provider: 'youtube' }
