/**
 * VerificationEditor.tsx — Verification lifecycle panel. REQ-017.
 *
 * Shows verification status, history, and "Mark as Verified" action.
 * Uses existing verifyEntity service function.
 */
import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, Clock, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { verifyEntity } from '@/services/entity/entityService'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { entityKeys } from '@/lib/queryKeys'
import type { EditorProps } from '../registry'
import { cn } from '@/lib/utils'

export default function VerificationEditor({ entityId }: EditorProps) {
  const qc = useQueryClient()
  const { data: entity } = useEntityQuery(entityId)
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [expanded, setExpanded] = useState(false)

  const mutation = useMutation({
    mutationFn: () => verifyEntity(entityId, 'current-user', sourceUrl || undefined, notes || undefined),
    onSuccess: () => {
      toast.success('Content marked as verified')
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) })
      setSourceUrl('')
      setNotes('')
      setExpanded(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!entity) return null

  const status = entity.lastVerifiedAt
    ? (Date.now() - new Date(entity.lastVerifiedAt).getTime()) > 90 * 86_400_000
      ? 'expired'
      : 'verified'
    : 'unverified'

  const statusConfig = {
    verified:   { icon: ShieldCheck,  color: 'text-green-600', bg: 'bg-green-50', label: 'Verified' },
    expired:    { icon: ShieldAlert,  color: 'text-red-600',   bg: 'bg-red-50',   label: 'Verification Expired' },
    unverified: { icon: Clock,        color: 'text-slate-500', bg: 'bg-slate-50',  label: 'Not Yet Verified' },
  }[status]

  const StatusIcon = statusConfig.icon

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Status Card */}
      <div className={cn('p-4 rounded-lg border flex items-center gap-4', statusConfig.bg)}>
        <StatusIcon className={cn('h-8 w-8', statusConfig.color)} />
        <div>
          <p className={cn('text-sm font-medium', statusConfig.color)}>{statusConfig.label}</p>
          {entity.lastVerifiedAt && (
            <p className="text-xs text-slate-500">
              Last verified: {new Date(entity.lastVerifiedAt).toLocaleDateString()} at {new Date(entity.lastVerifiedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Verify Action */}
      <div className="p-4 rounded-lg bg-white border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Verify Content</h3>
          {!expanded && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Mark as Verified
            </button>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded ? 'Collapse details' : 'Add source URL and notes (optional)'}
        </button>

        {expanded && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Official Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://official-website.gov.in/notification"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Verification Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Verified against official notification PDF dated..."
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Confirm Verification
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
