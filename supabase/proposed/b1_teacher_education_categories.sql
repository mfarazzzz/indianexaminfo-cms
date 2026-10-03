-- ═══════════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §1 (B1).
-- Teacher Education — ONE FLAT category (owner decision, 2026-10-03: "one flat category
-- under the admission pillar (slug teacher-education). No sub-category tree unless you
-- show me why it's needed now." Nothing needs a tree now, so this file deliberately does
-- NOT create children).
--
-- Categories already live in the DB (table `categories`, migrations/20260702150637:2-20);
-- adding this row is a DATA operation done through the existing /categories admin screen
-- (src/pages/categories/CategoriesPage.tsx), NOT code. The owner will add it themselves.
-- AI Fill must read `categories` (not the hard-coded prompt list at
-- src/lib/ai/autofill.ts:168) — that wiring is a later slice (S2), not S1.
--
-- pillar value: entrance-exam (public root /admission; per the DB CHECK on exams
-- pillar<->entity_type, migrations/20260926023410:13). A state counselling admission
-- (UP D.El.Ed) is entity_type='university-admission' + selection_model='merit-based' (§1 B2).
--
-- If a tree is ever justified later, children (d-el-ed, b-ed, m-ed, shiksha-shastri) can
-- be added via parent_id; exams.subcategory_id already exists. Deferred until needed.
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ── LIVE CATEGORY COUNTS ─────────────────────────────────────────────────────────
-- Owner rule: proposed SQL ships WITH current counts. The agent could not run these
-- this session (the Supabase MCP requires OAuth authorization — every call returned
-- "mcpServer supabase requires OAuth authorization"), so they are embedded here as
-- READ-ONLY queries. Run them in the SQL editor BEFORE promoting the row, and attach
-- the output to the PR/issue. NOTHING below writes anything.

-- 1. Categories per pillar (how flat the taxonomy is today). No deleted_at on this
--    table (20260702150637:2-17) — is_active is the only state column:
SELECT pillar,
       count(*) AS categories,
       count(*) FILTER (WHERE is_active) AS active
FROM categories
GROUP BY pillar
ORDER BY pillar;

-- 2. Every existing category with its usage — the context for choosing order_index
--    and for spotting a pre-existing teacher-education-ish row to rename instead:
SELECT c.pillar, c.slug, c.name,
       count(e.id) AS exams_using
FROM categories c
LEFT JOIN exams e ON e.category_id = c.id
GROUP BY c.id
ORDER BY c.pillar, c.order_index;

-- 3. Guard: confirm the target slug is actually free before inserting:
SELECT id, slug, name, pillar FROM categories WHERE slug = 'teacher-education';

-- ── THE ROW (documentation of the intended insert — owner promotes via /categories
--    admin screen or runs this himself; NOT applied by the agent) ──────────────────

-- Single flat row — the intended statement (order_index from count query 2):
INSERT INTO categories (slug, name, pillar, order_index, is_active)
VALUES ('teacher-education', 'Teacher Education', 'entrance-exam',
        (SELECT coalesce(max(order_index), 0) + 1 FROM categories WHERE pillar = 'entrance-exam'),
        true)
ON CONFLICT (slug) DO NOTHING;
