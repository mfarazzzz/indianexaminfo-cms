/**
 * FX3 A4 — getErrorMessage maps Postgres constraint codes to plain language and
 * never leaks raw constraint names to the editor.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getErrorMessage } from './utils'

afterEach(() => { vi.restoreAllMocks() })

/** A PostgREST-shaped error object (what supabase-js returns in `.error`). */
function pg(code: string, message: string, constraint?: string) {
  return { code, message, details: "", hint: "", ...(constraint ? { constraint } : {}) }
}

describe('getErrorMessage Postgres code mapping (A4)', () => {
  it('23505 unique (exam edition) -> plain "cycle already exists", no raw constraint name', () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const msg = getErrorMessage(pg("23505", 'duplicate key value violates unique constraint "uq_exam_edition_year_session"'))
    expect(msg).toMatch(/cycle already exists/i)
    expect(msg).not.toContain("uq_exam_edition_year_session") // never leak the raw name
  })

  it('23505 generic -> "already exists", no raw name', () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const msg = getErrorMessage(pg("23505", 'duplicate key value violates unique constraint "exams_slug_key"'))
    expect(msg).toMatch(/already exists/i)
    expect(msg).not.toContain("exams_slug_key")
  })

  it('23503 foreign key -> linked-record message', () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const msg = getErrorMessage(pg("23503", 'insert or update on table "exam_editions" violates foreign key constraint "exam_editions_exam_id_fkey"'))
    expect(msg).toMatch(/linked record/i)
    expect(msg).not.toContain("exam_editions_exam_id_fkey")
  })

  it('23514 check (important_dates) -> names the date field', () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const msg = getErrorMessage(pg("23514", 'new row for relation "exam_editions" violates check constraint "exam_editions_important_dates_valid"'))
    expect(msg).toMatch(/date/i)
    expect(msg).not.toContain("exam_editions_important_dates_valid")
  })

  it('42501 / RLS -> permission message', () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const msg = getErrorMessage(pg("42501", "new row violates row-level security policy"))
    expect(msg).toMatch(/permission/i)
  })

  it('an unknown code falls through to the raw message (unchanged behaviour)', () => {
    const msg = getErrorMessage(pg("XX000", "some unusual failure"))
    expect(msg).toBe("some unusual failure")
  })

  it('a plain Error is returned verbatim (not treated as a PG error)', () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom")
  })
})
