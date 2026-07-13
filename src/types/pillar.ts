/**
 * pillar.ts — Structural taxonomy: top-level platform categories
 * Pillars are database-driven (not hardcoded). Adding a pillar = 1 DB row.
 */

export interface Pillar {
  id: string
  slug: string
  label: string
  description?: string | null
  icon?: string | null
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface PillarInput {
  slug: string
  label: string
  description?: string
  icon?: string
  displayOrder?: number
  isActive?: boolean
}
