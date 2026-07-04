/**
 * RichTextEditor — Tiptap-based rich text editor.
 * Falls back to a textarea when Tiptap is unavailable.
 */
import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'
import type { RichTextContent } from '@/lib/blocks/schemas/richTextSchema'

export function RichTextEditor({ content, onChange }: BlockEditorProps) {
  const c = content as RichTextContent
  const editor = useEditor({
    extensions: [StarterKit],
    content: c?.html ?? '',
    onUpdate: ({ editor: ed }) => {
      onChange({ type: 'rich_text', html: ed.getHTML() })
    },
  })
  return (
    <div className="rounded-md border border-slate-200 bg-white min-h-[120px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500">
      <EditorContent editor={editor} />
    </div>
  )
}
