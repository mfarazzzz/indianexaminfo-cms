import React from 'react'
import type { TableContent } from '@/lib/blocks/schemas/tableSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function TableRenderer({ content }: BlockRendererProps) {
  const { headers = [], rows = [] } = content as TableContent
  if (headers.length === 0) return <p className="text-sm text-slate-400 italic">Empty table.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="even:bg-slate-50">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-slate-200 px-3 py-2 text-slate-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
