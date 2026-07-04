import React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TableSchema, type TableContent } from '@/lib/blocks/schemas/tableSchema'
import { inputCls } from '@/components/shared/form/FormField'
import { Plus, Trash2 } from 'lucide-react'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function TableEditor({ content, onChange }: BlockEditorProps) {
  const { register, control, watch, setValue } = useForm<TableContent>({
    resolver: zodResolver(TableSchema),
    defaultValues: (content as TableContent) ?? { type: 'table', headers: [''], rows: [['']] },
  })
  const { fields: headerFields } = useFieldArray({ control, name: 'headers' as never })
  const notify = () => onChange({ type: 'table', headers: watch('headers'), rows: watch('rows') })
  const headers = watch('headers')
  const rows = watch('rows')

  const addCol = () => {
    setValue('headers', [...headers, ''])
    setValue('rows', rows.map(r => [...r, '']))
    notify()
  }
  const addRow = () => { setValue('rows', [...rows, headers.map(() => '')]); notify() }
  const removeRow = (i: number) => { setValue('rows', rows.filter((_, idx) => idx !== i)); notify() }

  return (
    <div className="space-y-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((_, ci) => (
              <th key={ci} className="border border-slate-200 p-1">
                <input className={inputCls + ' h-7 text-xs'} placeholder={`Col ${ci+1}`}
                  {...register(`headers.${ci}`, { onChange: notify })} />
              </th>
            ))}
            <th className="border border-slate-200 p-1 w-8">
              <button type="button" onClick={addCol} aria-label="Add column"
                className="text-blue-600 hover:text-blue-800"><Plus className="h-3.5 w-3.5" /></button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((_, ci) => (
                <td key={ci} className="border border-slate-200 p-1">
                  <input className={inputCls + ' h-7 text-xs'} placeholder="…"
                    {...register(`rows.${ri}.${ci}`, { onChange: notify })} />
                </td>
              ))}
              <td className="border border-slate-200 p-1 text-center">
                <button type="button" onClick={() => removeRow(ri)} aria-label="Remove row"
                  className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
        <Plus className="h-4 w-4" /> Add Row
      </button>
    </div>
  )
}
