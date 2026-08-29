import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequirePermission } from "./RequirePermission";
import { P } from "@/config/permissions";
import { LoginPage } from "@/pages/auth/LoginPage";
import { Loader2 } from "lucide-react";

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
    </div>
  );
}

/** sessionStorage key used to prevent an infinite reload loop on chunk failures. */
const CHUNK_RELOAD_KEY = "chunk-reload-attempted";

/**
 * Detects a failed dynamic import / stale-chunk error. After a redeploy, the
 * cached index.html can reference old hashed chunk filenames that 404, which
 * throws one of these errors when React tries to lazy-load a page.
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("chunkloaderror") ||
    msg.includes("unable to preload css")
  );
}

/**
 * Error boundary for lazy-loaded page chunks.
 *
 * For stale-chunk errors (common right after a deploy), it forces a single
 * hard reload so the browser fetches a fresh index.html + valid chunk names.
 * A sessionStorage guard prevents an infinite reload loop if the error is not
 * actually caused by a stale chunk.
 */
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    // Auto-recover from stale-chunk 404s: force one hard reload to pull the
    // new index.html. Guard against loops in case the reload doesn't fix it.
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
  }
  private handleReload = () => {
    // Manual reload always clears the guard so a fresh attempt is made.
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-slate-600">Failed to load this page.</p>
          <button
            onClick={this.handleReload}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function lazyPage(
  factory: () => Promise<Record<string, unknown>>,
  exportName: string
): React.ComponentType {
  const Component = lazy(() =>
    factory().then((m) => ({ default: m[exportName] as React.ComponentType }))
  );
  return function LazyWrapper() {
    return (
      <LazyErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Component />
        </Suspense>
      </LazyErrorBoundary>
    );
  };
}

const DashboardPage     = lazyPage(() => import("@/pages/dashboard/DashboardPage"),     "DashboardPage");
// M3.8: Pillar-agnostic entity pages
const EntityListPage    = lazyPage(() => import("@/pages/entities/EntityListPage"),     "EntityListPage");
const EntityEditorPage  = lazyPage(() => import("@/pages/entities/EntityEditorPage"),   "EntityEditorPage");
const EntityCreationPage = lazyPage(() => import("@/pages/entities/EntityCreationPage"),"EntityCreationPage");
// M3.8: Taxonomy manager
const TaxonomyManagerPage = lazyPage(() => import("@/pages/taxonomy/TaxonomyManagerPage"), "TaxonomyManagerPage");
// Legacy pages (kept for non-entity features)
const ExamsListPage     = lazyPage(() => import("@/pages/exams/ExamsListPage"),         "ExamsListPage");
const ExamEditorPage    = lazyPage(() => import("@/pages/exams/ExamEditorPage"),        "ExamEditorPage");
const BlogAuthorsPage   = lazyPage(() => import("@/pages/blog/BlogAuthorsPage"),        "BlogAuthorsPage");
// Unified Content Management (replaces Content Posts, Blog Posts, Education News)
const UnifiedContentListPage   = lazyPage(() => import("@/pages/unified-content/UnifiedContentListPage"),   "UnifiedContentListPage");
const UnifiedContentEditorPage = lazyPage(() => import("@/pages/unified-content/UnifiedContentEditorPage"), "UnifiedContentEditorPage");
const CategoriesPage    = lazyPage(() => import("@/pages/categories/CategoriesPage"),  "CategoriesPage");
const MenusPage         = lazyPage(() => import("@/pages/menus/MenusPage"),             "MenusPage");
const PagesListPage     = lazyPage(() => import("@/pages/pages/PagesListPage"),         "PagesListPage");
const PageEditPage      = lazyPage(() => import("@/pages/pages/PageEditPage"),          "PageEditPage");
const MediaLibraryPage  = lazyPage(() => import("@/pages/media/MediaLibraryPage"),     "MediaLibraryPage");
const AdDashboardPage   = lazyPage(() => import("@/pages/ads/AdDashboardPage"),        "AdDashboardPage");
const CampaignsListPage = lazyPage(() => import("@/pages/ads/CampaignsListPage"),      "CampaignsListPage");
const CampaignEditPage  = lazyPage(() => import("@/pages/ads/CampaignEditPage"),       "CampaignEditPage");
const CreativesPage     = lazyPage(() => import("@/pages/ads/CreativesPage"),           "CreativesPage");
const ZonesPage         = lazyPage(() => import("@/pages/ads/ZonesPage"),               "ZonesPage");
const ReportsPage       = lazyPage(() => import("@/pages/ads/ReportsPage"),             "ReportsPage");
const UsersListPage     = lazyPage(() => import("@/pages/users/UsersListPage"),         "UsersListPage");
const SettingsPage      = lazyPage(() => import("@/pages/settings/SettingsPage"),       "SettingsPage");
const AuditLogPage      = lazyPage(() => import("@/pages/audit/AuditLogPage"),          "AuditLogPage");
// Govt Exam (Government Competitive Exams — UPSC, SSC, RRB, etc.)
const GovtExamListPage = lazyPage(() => import("@/pages/govt-exam/GovtExamListPage"), "GovtExamListPage");
const GovtExamEditorPage = lazyPage(() => import("@/pages/govt-exam/GovtExamEditorPage"), "default");
// Entrance Exams (dedicated editorial workflow)
const EntranceExamListPage  = lazyPage(() => import("@/pages/entrance-exams/EntranceExamListPage"),   "EntranceExamListPage");
const EntranceExamEditorPage = lazyPage(() => import("@/pages/entrance-exams/EntranceExamEditorPage"), "EntranceExamEditorPage");
// Sarkari Bharti (State Recruitments)
const SarkariBhartiListPage = lazyPage(() => import("@/pages/sarkari-bharti/SarkariBhartiListPage"), "SarkariBhartiListPage");
// University Exams
const UniversityExamsListPage = lazyPage(() => import("@/pages/university-exams/UniversityExamsListPage"), "UniversityExamsListPage");
// Board Exams
const BoardExamsListPage = lazyPage(() => import("@/pages/board-exams/BoardExamsListPage"), "BoardExamsListPage");
// Navigation Settings
const NavigationSettingsPage = lazyPage(() => import("@/pages/navigation/NavigationSettingsPage"), "NavigationSettingsPage");

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/",      element: <Navigate to="/dashboard" replace /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard",         element: <DashboardPage /> },
          // M3.8: Pillar-agnostic entity routes (zero code change for new pillars)
          { path: "/entities",             element: <EntityListPage /> },
          { path: "/entities/:pillar",     element: <EntityListPage /> },
          { path: "/entities/:pillar/new", element: <EntityCreationPage /> },
          { path: "/entities/:pillar/:id", element: <EntityEditorPage /> },
          // M3.8: Taxonomy manager
          { path: "/taxonomy",             element: <TaxonomyManagerPage /> },
          { path: "/taxonomy/:type",       element: <TaxonomyManagerPage /> },
          // Exam Manager — directly targets legacy `exams` table (what frontend reads)
          { path: "/exams",             element: <ExamsListPage /> },
          { path: "/exams/new",         element: <ExamEditorPage /> },
          { path: "/exams/:id",         element: <ExamEditorPage /> },
          { path: "/content",           element: <UnifiedContentListPage /> },
          { path: "/content/new",       element: <UnifiedContentEditorPage /> },
          { path: "/content/:id",       element: <UnifiedContentEditorPage /> },
          // Blog Authors (standalone management)
          { path: "/blog/authors",      element: <BlogAuthorsPage /> },
          // Redirects from old routes
          { path: "/blog",              element: <Navigate to="/content" replace /> },
          { path: "/blog/new",          element: <Navigate to="/content/new" replace /> },
          { path: "/blog/:id",          element: <Navigate to="/content" replace /> },
          { path: "/categories",        element: <CategoriesPage /> },
          { path: "/navigation",        element: <NavigationSettingsPage /> },
          { path: "/menus",             element: <MenusPage /> },
          { path: "/pages",             element: <PagesListPage /> },
          { path: "/pages/new",         element: <PageEditPage /> },
          { path: "/pages/:id",         element: <PageEditPage /> },
          { path: "/media",             element: <MediaLibraryPage /> },
          { path: "/ads",               element: <AdDashboardPage /> },
          { path: "/ads/campaigns",     element: <CampaignsListPage /> },
          { path: "/ads/campaigns/new", element: <CampaignEditPage /> },
          { path: "/ads/campaigns/:id", element: <CampaignEditPage /> },
          { path: "/ads/creatives",     element: <CreativesPage /> },
          { path: "/ads/zones",         element: <ZonesPage /> },
          { path: "/ads/reports",       element: <ReportsPage /> },
          // CMS Results (LEGACY — redirects to Govt Exam)
          { path: "/results",           element: <Navigate to="/govt-exam" replace /> },
          { path: "/results/new",       element: <Navigate to="/govt-exam/new" replace /> },
          { path: "/results/:id",       element: <Navigate to="/govt-exam" replace /> },
          // CMS Education News (redirects to unified content)
          { path: "/education-news",       element: <Navigate to="/content" replace /> },
          { path: "/education-news/new",   element: <Navigate to="/content/new" replace /> },
          { path: "/education-news/:id",   element: <Navigate to="/content" replace /> },
          // Govt Exam (Government Competitive Exams — UPSC, SSC, RRB, etc.)
          { path: "/govt-exam",            element: <GovtExamListPage /> },
          { path: "/govt-exam/new",        element: <GovtExamEditorPage /> },
          { path: "/govt-exam/:id",        element: <GovtExamEditorPage /> },
          // Legacy Sarkari Naukri redirects → Govt Exam
          { path: "/sarkari-naukri",       element: <Navigate to="/govt-exam" replace /> },
          { path: "/sarkari-naukri/new",   element: <Navigate to="/govt-exam/new" replace /> },
          { path: "/sarkari-naukri/:id",   element: <Navigate to="/govt-exam" replace /> },
          // Entrance Exams (dedicated editorial workflow)
          { path: "/entrance-exams",       element: <EntranceExamListPage /> },
          { path: "/entrance-exams/new",   element: <EntranceExamEditorPage /> },
          { path: "/entrance-exams/:id",   element: <EntranceExamEditorPage /> },
          // Govt Vacancy (previously Sarkari Bharti)
          { path: "/govt-vacancy",         element: <SarkariBhartiListPage /> },
          { path: "/govt-vacancy/new",     element: <EntranceExamEditorPage /> },
          { path: "/govt-vacancy/:id",     element: <EntranceExamEditorPage /> },
          // Legacy routes (redirect to new)
          { path: "/sarkari-bharti",       element: <SarkariBhartiListPage /> },
          { path: "/sarkari-bharti/new",   element: <EntranceExamEditorPage /> },
          { path: "/sarkari-bharti/:id",   element: <EntranceExamEditorPage /> },
          // University Exams
          { path: "/university-exams",     element: <UniversityExamsListPage /> },
          { path: "/university-exams/new", element: <EntranceExamEditorPage /> },
          { path: "/university-exams/:id", element: <EntranceExamEditorPage /> },
          // Board Exams
          { path: "/board-exams",          element: <BoardExamsListPage /> },
          { path: "/board-exams/new",      element: <EntranceExamEditorPage /> },
          { path: "/board-exams/:id",      element: <EntranceExamEditorPage /> },
          { path: "/users",             element: <RequirePermission anyOf={[P.MANAGE_USERS]}><UsersListPage /></RequirePermission> },
          { path: "/settings",          element: <RequirePermission anyOf={[P.MANAGE_SETTINGS]}><SettingsPage /></RequirePermission> },
          { path: "/audit",             element: <RequirePermission anyOf={[P.VIEW_AUDIT_LOG]}><AuditLogPage /></RequirePermission> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
