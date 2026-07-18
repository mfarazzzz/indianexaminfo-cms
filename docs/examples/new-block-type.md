# Example: Adding a New Block Type

> Step-by-step guide to adding a "Code Snippet" block to the CMS.

---

## Step 1: Create the Zod Schema

```typescript
// src/lib/blocks/schemas/codeSchema.ts
import { z } from 'zod'

export const CodeSchema = z.object({
  type: z.literal('code'),
  language: z.string().default('javascript'),
  code: z.string().default(''),
  showLineNumbers: z.boolean().default(true),
  caption: z.string().optional(),
})

export const codeDefault = {
  type: 'code' as const,
  language: 'javascript',
  code: '',
  showLineNumbers: true,
  caption: '',
}
```

## Step 2: Create the Editor Component

```typescript
// src/components/blocks/editors/CodeEditor.tsx
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function CodeEditor({ content, onChange }: BlockEditorProps) {
  const data = content as { language: string; code: string; showLineNumbers: boolean; caption?: string }

  return (
    <div className="space-y-3">
      {/* Language selector */}
      <select
        value={data.language}
        onChange={(e) => onChange({ ...content, language: e.target.value })}
        className="rounded border px-3 py-1.5 text-sm"
      >
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="sql">SQL</option>
        <option value="bash">Bash</option>
      </select>

      {/* Code textarea */}
      <textarea
        value={data.code}
        onChange={(e) => onChange({ ...content, code: e.target.value })}
        className="w-full rounded border bg-slate-900 p-4 font-mono text-sm text-green-400"
        rows={10}
        placeholder="Enter code here..."
      />

      {/* Caption */}
      <input
        value={data.caption ?? ''}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        className="w-full rounded border px-3 py-1.5 text-sm"
        placeholder="Optional caption"
      />
    </div>
  )
}
```

## Step 3: Create the Renderer Component

```typescript
// src/components/blocks/renderers/CodeRenderer.tsx
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function CodeRenderer({ content }: BlockRendererProps) {
  const data = content as { language: string; code: string; caption?: string }

  return (
    <div className="my-4">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4">
        <code className="text-sm text-slate-100">{data.code}</code>
      </pre>
      {data.caption && (
        <p className="mt-1 text-center text-xs text-slate-500">{data.caption}</p>
      )}
    </div>
  )
}
```

## Step 4: Register the Block

```typescript
// In src/lib/blocks/coreBlocks.ts — add to registerCoreBlocks():

import { CodeSchema, codeDefault } from './schemas/codeSchema'
import { CodeEditor } from '@/components/blocks/editors/CodeEditor'
import { CodeRenderer } from '@/components/blocks/renderers/CodeRenderer'
import { Code } from 'lucide-react'

// Inside registerCoreBlocks():
register({
  type: 'code',
  label: 'Code Snippet',
  icon: Code,
  schema: CodeSchema,
  defaultContent: codeDefault,
  editor: CodeEditor,
  renderer: CodeRenderer,
  summary: (content) => `${(content as any).language}: ${((content as any).code as string).slice(0, 30)}...`,
})
```

## Result

That's it. Zero changes to:
- `BlockRenderer.tsx`
- `AddBlockMenu.tsx`
- `ModuleEditor.tsx`
- Any other shared component

The new block type automatically appears in the "Add Block" palette, validates on save, and renders in preview mode.
