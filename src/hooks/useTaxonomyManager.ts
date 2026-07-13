/**
 * useTaxonomyManager.ts — Manages descriptive taxonomy for TaxonomyManagerPage.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taxonomyKeys, entityKeys } from '@/lib/queryKeys'
import {
  listTaxonomy,
  createTaxonomy,
  renameTaxonomy,
  mergeTaxonomy,
  disableTaxonomy,
  getTaxonomyUsageCount,
} from '@/services/taxonomy/taxonomyService'
import type { TaxonomyBase, TaxonomyTable, TaxonomyInput, MergeResult } from '@/types/taxonomy'

export function useTaxonomyManager<T extends TaxonomyBase>(table: TaxonomyTable) {
  const qc = useQueryClient()
  const queryKey = taxonomyKeys.list(table)
  const [searchTerm, setSearchTerm] = useState('')

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const { data: items = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listTaxonomy<T>(table),
    staleTime: 2 * 60_000,
  })

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items
    const lower = searchTerm.toLowerCase()
    return items.filter(
      item => item.label.toLowerCase().includes(lower) || item.slug.includes(lower)
    )
  }, [items, searchTerm])

  // ── Create ──────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: TaxonomyInput) => createTaxonomy<T>(table, input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Rename ──────────────────────────────────────────────────────────────────
  const renameMutation = useMutation({
    mutationFn: ({ id, newLabel }: { id: string; newLabel: string }) =>
      renameTaxonomy(table, id, newLabel),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Merge ───────────────────────────────────────────────────────────────────
  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      mergeTaxonomy(table, sourceId, targetId),
    onSuccess: (_result: MergeResult) => {
      qc.invalidateQueries({ queryKey })
      // Entity lists must be refreshed because FK references changed
      qc.invalidateQueries({ queryKey: entityKeys.lists() })
    },
  })

  // ── Disable ─────────────────────────────────────────────────────────────────
  const disableMutation = useMutation({
    mutationFn: (id: string) => disableTaxonomy(table, id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Usage count ──────────────────────────────────────────────────────────────
  const getUsageCount = (id: string) => getTaxonomyUsageCount(table, id)

  return {
    items: filteredItems,
    allItems: items,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    rename: renameMutation.mutate,
    isRenaming: renameMutation.isPending,
    merge: mergeMutation.mutate,
    isMerging: mergeMutation.isPending,
    mergeError: mergeMutation.error,
    disable: disableMutation.mutate,
    getUsageCount,
  }
}
