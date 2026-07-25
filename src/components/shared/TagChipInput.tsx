/**
 * TagChipInput — Reusable tag/chip input component.
 * Adds chips on Enter or comma, validates length/duplication/max count.
 * Used for Selection Process stages. (Req 13.1–13.5)
 */
import React, { useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagChipInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  max?: number
  maxLength?: number
  placeholder?: string
  disabled?: boolean
}

export function TagChipInput({
  value,
  onChange,
  max = 20,
  maxLength = 100,
  placeholder = 'Type and press Enter…',
  disabled = false,
}: TagChipInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addChip = useCallback((raw: string) => {
    const trimmed = raw.trim()
    setError(null)

    if (!trimmed) {
      setError('Cannot add empty tag')
      return
    }
    if (trimmed.length > maxLength) {
      setError(`Maximum ${maxLength} characters`)
      return
    }
    if (value.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      setError('Duplicate — already exists')
      return
    }
    if (value.length >= max) {
      setError(`Maximum ${max} tags reached`)
      return
    }

    onChange([...value, trimmed])
    setInput('')
  }, [value, onChange, max, maxLength])

  const removeChip = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setError(null)
  }, [value, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addChip(input)
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeChip(value.length - 1)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // If user pastes with commas, split and add each
    if (val.includes(',')) {
      const parts = val.split(',')
      parts.forEach((part, i) => {
        if (i < parts.length - 1) addChip(part)
      })
      setInput(parts[parts.length - 1])
    } else {
      setInput(val)
      setError(null)
    }
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 min-h-[36px]',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeChip(idx) }}
                className="rounded-full p-0.5 hover:bg-blue-200 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && value.length < max && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] text-sm outline-none placeholder:text-slate-400 bg-transparent"
            disabled={disabled}
          />
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}
      <p className="text-xs text-slate-400">{value.length}/{max} tags</p>
    </div>
  )
}
