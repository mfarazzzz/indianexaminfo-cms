/**
 * useTemplates.ts — Lifecycle template hooks for creation wizard and admin UI.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { templateKeys } from '@/lib/queryKeys'
import {
  listTemplates,
  listTemplateVersions,
  getActiveTemplateVersion,
  activateTemplateVersion,
  cloneTemplateVersion,
} from '@/services/template/templateService'
import type { LifecycleTemplate, LifecycleTemplateVersion } from '@/types/lifecycle-template'

export function useTemplates(pillarId?: string): UseQueryResult<LifecycleTemplate[]> {
  return useQuery({
    queryKey: templateKeys.list(pillarId),
    queryFn:  () => listTemplates(pillarId),
    enabled:  !!pillarId,
    staleTime: 5 * 60_000,
  })
}

export function useTemplateVersions(
  templateId: string
): UseQueryResult<LifecycleTemplateVersion[]> {
  return useQuery({
    queryKey: templateKeys.versions(templateId),
    queryFn:  () => listTemplateVersions(templateId),
    enabled:  !!templateId,
    staleTime: 60_000,
  })
}

export function useActiveTemplateVersion(
  templateId: string
): UseQueryResult<LifecycleTemplateVersion | null> {
  return useQuery({
    queryKey: [...templateKeys.versions(templateId), 'active'],
    queryFn:  () => getActiveTemplateVersion(templateId),
    enabled:  !!templateId,
    staleTime: 5 * 60_000,
  })
}

export function useActivateTemplateVersion(): UseMutationResult<
  void,
  Error,
  { versionId: string; templateId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId }) => activateTemplateVersion(versionId),
    onSuccess: (_, { templateId }) => {
      qc.invalidateQueries({ queryKey: templateKeys.versions(templateId) })
    },
  })
}

export function useCloneTemplateVersion(): UseMutationResult<
  LifecycleTemplateVersion,
  Error,
  { versionId: string; templateId: string; userId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, userId }) => cloneTemplateVersion(versionId, userId),
    onSuccess: (_, { templateId }) => {
      qc.invalidateQueries({ queryKey: templateKeys.versions(templateId) })
    },
  })
}
