import { z } from 'zod'
export const DownloadCardSchema = z.object({
  type:       z.literal('download_card'),
  downloadId: z.string().uuid(),
})
export type DownloadCardContent = z.infer<typeof DownloadCardSchema>
export const downloadCardDefault: DownloadCardContent = { type: 'download_card', downloadId: '00000000-0000-0000-0000-000000000000' }
