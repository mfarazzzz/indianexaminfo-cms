# Implementation Plan: Navigation Mega Menu Redesign

## Overview

This plan implements a complete navigation architecture redesign — from the current 3-pillar static hardcoded menu to a scalable 6-domain taxonomy-driven mega menu system with 3-column layout, CMS management, and dual static/dynamic mode.

## Tasks

- [x] 1. Create database schema — taxonomy_nodes, taxonomy_facets, navigation_revisions, taxonomy_redirects tables with indexes, constraints, and RLS policies. Expand pillar enum with government-exam, government-jobs, university-exam, news values. Enable pg_trgm extension.
- [x] 2. Create shared TypeScript navigation types — types/navigation.ts in both frontend and CMS with Pillar (6 values), BadgeType, DiscoveryFacet, TaxonomyNode, NavigationTree, NavigationPanelData, ContextualPanelData, NavigationItem, NotificationItem, NavigationConfig, PillarConfig, QuickAccessItem, NavigationSearchResult interfaces. Update types/exam.ts Pillar type for backward compatibility.
- [x] 3. Build navigation service with dual-mode resolver — Create taxonomyService.ts with getNavigationTree(pillar), getAllNavigationTrees(), resolveBreadcrumb(path), getContextualData(nodeId), searchNavigation(query, pillar). Implement static mode (read JSON file) and dynamic mode (Supabase ISR query with recursive CTE). Add NAVIGATION_MODE env variable and fallback chain.
- [x] 4. Seed static navigation data for all 6 pillars — Create data/navigation.json with complete taxonomy trees: Government Exams (12 categories), Government Jobs (30+ job types with sub-categories), Entrance Exams (12 fields with specific exams), University Exams (12 university types with popular universities), Board Exams (national + 30 state boards), News (25 categories). Include quick access items.
- [x] 5. Build 3-column desktop NavigationPanel — Create CategorySidebar.tsx (left: pinned items, category list, icons, badges, hover/selected states), SubCategoryPanel.tsx (middle: sub-categories of selected category, exam links, View All), ContextualPanel.tsx (right: Featured, Trending, Recently Updated, Latest Updates). Rewrite NavigationPanel.tsx with 3-column grid layout, search bar, panel positioning (fixed, full-width, max-height 70vh), open/close animations (200ms), keyboard navigation (Tab/Arrow/Enter/Escape).
- [x] 6. Rewrite header and pillar triggers for 6 domains — Update HeaderWithMenu.tsx to load from static JSON and pass NavigationTree[] to HeaderMegaNav. Rewrite HeaderMegaNav.tsx for 6 pillar triggers with hover intent (60ms), active indicator, chevron rotation, overflow scroll on smaller viewports. Implement hover coordination between trigger and panel.
- [x] 7. Build mobile navigation drawer with progressive disclosure — Rewrite MegaMenuMobile.tsx with slide-in-from-left animation (300ms spring), backdrop overlay, pillar accordions, category expansion (one level at a time), mobile search input, Quick Links section, swipe-to-close gesture, body scroll lock, 44x44px touch targets.
- [x] 8. Build sticky Quick Access Bar with compact scroll mode — Rewrite QuickAccessBar.tsx with static data, sticky positioning below header, h-9, horizontal scroll, backdrop-blur. Add compact header mode (56px → 48px) on 100px scroll. Close mega menu on scroll event.
- [x] 9. Build breadcrumb system from taxonomy paths — Create BreadcrumbTrail.tsx server component. Implement resolveBreadcrumb(path) in taxonomyService. Generate JSON-LD BreadcrumbList schema. Style with separator arrows, truncation for deep paths. Integrate into exam detail pages and category pages.
- [ ] 10. Build CMS taxonomy tree editor interface — Create NavigationManagerPage.tsx with pillar tab selector. Create TaxonomyTreeEditor.tsx with drag-and-drop tree. Create TaxonomyNodeEditor.tsx with form panel (label, slug, icon, badge, description, SEO, facets, featured items). Implement CRUD, bulk operations, publish action, live preview, revision history, Export to Static JSON, and validation (slug format, uniqueness, circular reference detection).
- [ ] 11. Implement dynamic route generation from taxonomy — Create catch-all route app/(public)/[...segments]/page.tsx for taxonomy path resolution. Add generateStaticParams() for ISR pre-rendering. Create taxonomy landing page template. Add URL redirect middleware for taxonomy_redirects. Maintain backward compatibility for /sarkari-naukri, /entrance-exam, /board-exam. Generate sitemap entries.
- [x] 12. Implement in-menu navigation search — Client-side fuzzy search over static data for instant results. Supabase server-side search with pg_trgm. Recent searches in localStorage (last 5). Popular searches display. Results grouped by category with taxonomy path. Cross-pillar "Also found in..." suggestions. Integration in both desktop panel and mobile drawer.
- [ ] 13. Build discovery facets and browsing pages — Create /browse/[facet]/[value] route. Implement getNodesByFacet query (cross-pillar). Create Browse by State (36 states/UTs) and Browse by Qualification pages. Add Browse By section to mega menu right panel. Generate sitemap entries for facet pages.
- [x] 14. Implement WCAG AA accessibility for navigation — Add ARIA roles (navigation, menu, menubar, menuitem, aria-expanded, aria-haspopup, aria-current). Focus management and focus trap in drawer. aria-live announcements. Visible focus indicator (3:1 contrast). Full keyboard navigation. axe-core audit and fixes. Skip navigation link. Color contrast validation.
- [x] 15. Performance optimization — Code-split NavigationPanel, MobileDrawer, ContextualPanel with next/dynamic. Assert bundle < 30KB gzipped. Ensure panel opens in 16ms (pre-loaded data). Lazy-load ContextualPanel on category hover only. Add will-change for animations. Prefetch adjacent pillar on hover >200ms. Remove legacy navigation code. Verify CLS = 0.

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2],
    [3, 10],
    [4],
    [5, 6, 7, 8, 9, 11, 12, 13],
    [14, 15]
  ]
}
```

## Notes

- Tasks 5, 6, 7, 8 can be developed in parallel once task 4 is complete
- Task 10 (CMS Editor) is independent of frontend tasks and can be developed in parallel with tasks 5-9
- Tasks 14 and 15 are cross-cutting and should be applied after core components are functional
- Backward compatibility with existing routes (/sarkari-naukri, /entrance-exam, /board-exam) is critical — handled via redirect mapping in task 11
- Start with static mode (NAVIGATION_MODE=static) for instant load; switch to dynamic after CMS editor is ready
