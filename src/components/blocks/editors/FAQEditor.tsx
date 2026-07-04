import React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FAQSchema, type FAQContent } from '@/lib/blocks/schemas/faqSchema'
import { FormField, inputCls, textareaCls } from '@/components/shared/form/FormField'
import { Plus, Trash2 } from 'lucide-react'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function FAQEditor({ content, onChange }: BlockEditorProps) {
  const { register, control, watch } = useForm<FAQContent>({
    resolver: zodResolver(FAQSchema),
    defaultValues: (content as FAQContent) ?? { type: 'faq', faqs: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'faqs' })
  const notify = () => onChange({ type: 'faq', faqs: watch('faqs') })
  return (
    <div className="space-y-3">
      {fields.map((field, idx) => (
        <div key={field.id} className="rounded border border-slate-200 p-3 space-y-2">
          <FormField label={`Q${idx + 1}`}>
            <input className={inputCls} placeholder="Question…"
              {...register(`faqs.${idx}.q`, { onChange: notify })} />
          </FormField>
          <FormField label="Answer">
            <textarea rows={2} className={textareaCls} placeholder="Answer…"
              {...register(`faqs.${idx}.a`, { onChange: notify })} />
          </FormField>
          <button type="button" onClick={() => { remove(idx); notify() }}
            aria-label="Remove FAQ item"
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => { append({ q: '', a: '' }); notify() }}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
        <Plus className="h-4 w-4" /> Add FAQ Item
      </button>
    </div>
  )
}
