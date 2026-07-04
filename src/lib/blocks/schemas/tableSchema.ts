import { z } from 'zod'
export const TableSchema = z.object({
  type:    z.literal('table'),
  headers: z.array(z.string()),
  rows:    z.array(z.array(z.string())),
})
export type TableContent = z.infer<typeof TableSchema>
export const tableDefault: TableContent = { type: 'table', headers: ['Column 1', 'Column 2'], rows: [['', '']] }
