import React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GallerySchema, type GalleryContent } from '@/lib/blocks/schemas/gallerySchema'
import { FormField, inputCls } from '@/components/shared/form/FormField'
import { Plus, Trash2 } from 'lucide-react'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function GalleryEditor({ content, onChange }: BlockEditorProps) {
  const { register, control, watch } = useForm<GalleryContent>({
    resolver: zodResolver(GallerySchema),
    defaultValues: (content as GalleryContent) ?? { type: 'gallery', images: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'images' })
  const notify = () => onChange({ type: 'gallery', images: watch('images') })
  return (
    <div className="space-y-3">
      {fields.map((field, idx) => (
        <div key={field.id} className="flex items-start gap-2 rounded border border-slate-200 p-3">
          <div className="flex-1 space-y-2">
            <FormField label="URL">
              <input type="url" className={inputCls} placeholder="https://…" {...register(`images.${idx}.url`, { onChange: notify })} />
            </FormField>
            <FormField label="Alt">
              <input className={inputCls} placeholder="Alt text" {...register(`images.${idx}.alt`, { onChange: notify })} />
            </FormField>
          </div>
          <button type="button" onClick={() => { remove(idx); notify() }} aria-label="Remove image"
            className="mt-6 rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => { append({ url: '', alt: '' }); notify() }}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
        <Plus className="h-4 w-4" /> Add Image
      </button>
    </div>
  )
}
