import { z } from 'zod'
export const TimelineReferenceSchema = z.object({
  type:     z.literal('timeline'),
  eventIds: z.array(z.string()),
})
export type TimelineReferenceContent = z.infer<typeof TimelineReferenceSchema>
export const timelineReferenceDefault: TimelineReferenceContent = { type: 'timeline', eventIds: [] }
