import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequirePermission } from "./RequirePermission";
import { P } from "@/config/permissions";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SetPasswordPage } from "@/pages/auth/SetPasswordPage";
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
  // Public set-password screen for invite acceptance, password reset, and forced
  // change after an admin-set temporary password. /auth/reset-password is kept as an
  // alias because existing reset emails point there.
  { path: "/auth/set-password",   element: <SetPasswordPage /> },
  { path: "/auth/reset-password", element: <SetPasswordPage /> },
  { path: "/",      element: <Navigate to="/dashboard" replace /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard",         element: <DashboardPage /> },
          // M3.8: Pillar-agnostic entity routes (zero code change for new pillars)
          { path: "/entities",             element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntityListPage /></RequirePermission> },
          { path: "/entities/:pillar",     element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntityListPage /></RequirePermission> },
          { path: "/entities/:pillar/new", element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntityCreationPage /></RequirePermission> },
          { path: "/entities/:pillar/:id", element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntityEditorPage /></RequirePermission> },
          // M3.8: Taxonomy manager
          { path: "/taxonomy",             element: <RequirePermission anyOf={[P.MANAGE_STRUCTURAL_TAXONOMY, P.MANAGE_CATEGORIES]}><TaxonomyManagerPage /></RequirePermission> },
          { path: "/taxonomy/:type",       element: <RequirePermission anyOf={[P.MANAGE_STRUCTURAL_TAXONOMY, P.MANAGE_CATEGORIES]}><TaxonomyManagerPage /></RequirePermission> },
          // Exam Manager — directly targets legacy `exams` table (what frontend reads)
          { path: "/exams",             element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><ExamsListPage /></RequirePermission> },
          { path: "/exams/new",         element: <RequirePermission anyOf={[P.CREATE_EXAM]}><ExamEditorPage /></RequirePermission> },
          { path: "/exams/:id",         element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><ExamEditorPage /></RequirePermission> },
          { path: "/content",           element: <RequirePermission anyOf={[P.CREATE_POST, P.EDIT_ANY_POST, P.EDIT_OWN_POST]}><UnifiedContentListPage /></RequirePermission> },
          { path: "/content/new",       element: <RequirePermission anyOf={[P.CREATE_POST]}><UnifiedContentEditorPage /></RequirePermission> },
          { path: "/content/:id",       element: <RequirePermission anyOf={[P.CREATE_POST, P.EDIT_ANY_POST, P.EDIT_OWN_POST]}><UnifiedContentEditorPage /></RequirePermission> },
          // Blog Authors (standalone management)
          { path: "/blog/authors",      element: <RequirePermission anyOf={[P.CREATE_POST, P.EDIT_ANY_POST]}><BlogAuthorsPage /></RequirePermission> },
          // Redirects from old routes
          { path: "/blog",              element: <Navigate to="/content" replace /> },
          { path: "/blog/new",          element: <Navigate to="/content/new" replace /> },
          { path: "/blog/:id",          element: <Navigate to="/content" replace /> },
          { path: "/categories",        element: <RequirePermission anyOf={[P.MANAGE_CATEGORIES]}><CategoriesPage /></RequirePermission> },
          { path: "/navigation",        element: <RequirePermission anyOf={[P.MANAGE_MENUS, P.MANAGE_CATEGORIES]}><NavigationSettingsPage /></RequirePermission> },
          { path: "/menus",             element: <RequirePermission anyOf={[P.MANAGE_MENUS]}><MenusPage /></RequirePermission> },
          { path: "/pages",             element: <RequirePermission anyOf={[P.MANAGE_PAGES]}><PagesListPage /></RequirePermission> },
          { path: "/pages/new",         element: <RequirePermission anyOf={[P.MANAGE_PAGES]}><PageEditPage /></RequirePermission> },
          { path: "/pages/:id",         element: <RequirePermission anyOf={[P.MANAGE_PAGES]}><PageEditPage /></RequirePermission> },
          { path: "/media",             element: <RequirePermission anyOf={[P.UPLOAD_MEDIA, P.DELETE_MEDIA]}><MediaLibraryPage /></RequirePermission> },
          { path: "/ads",               element: <RequirePermission anyOf={[P.MANAGE_ADS, P.MANAGE_AD_ZONES, P.VIEW_OWN_ADS]}><AdDashboardPage /></RequirePermission> },
          { path: "/ads/campaigns",     element: <RequirePermission anyOf={[P.MANAGE_ADS, P.VIEW_OWN_ADS]}><CampaignsListPage /></RequirePermission> },
          { path: "/ads/campaigns/new", element: <RequirePermission anyOf={[P.MANAGE_ADS]}><CampaignEditPage /></RequirePermission> },
          { path: "/ads/campaigns/:id", element: <RequirePermission anyOf={[P.MANAGE_ADS, P.VIEW_OWN_ADS]}><CampaignEditPage /></RequirePermission> },
          { path: "/ads/creatives",     element: <RequirePermission anyOf={[P.MANAGE_ADS]}><CreativesPage /></RequirePermission> },
          { path: "/ads/zones",         element: <RequirePermission anyOf={[P.MANAGE_AD_ZONES]}><ZonesPage /></RequirePermission> },
          { path: "/ads/reports",       element: <RequirePermission anyOf={[P.MANAGE_ADS, P.VIEW_OWN_ADS]}><ReportsPage /></RequirePermission> },
          // CMS Results (LEGACY — redirects to Govt Exam)
          { path: "/results",           element: <Navigate to="/govt-exam" replace /> },
          { path: "/results/new",       element: <Navigate to="/govt-exam/new" replace /> },
          { path: "/results/:id",       element: <Navigate to="/govt-exam" replace /> },
          // CMS Education News (redirects to unified content)
          { path: "/education-news",       element: <Navigate to="/content" replace /> },
          { path: "/education-news/new",   element: <Navigate to="/content/new" replace /> },
          { path: "/education-news/:id",   element: <Navigate to="/content" replace /> },
          // Govt Exam (Government Competitive Exams — UPSC, SSC, RRB, etc.)
          { path: "/govt-exam",            element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><GovtExamListPage /></RequirePermission> },
          { path: "/govt-exam/new",        element: <RequirePermission anyOf={[P.CREATE_EXAM]}><GovtExamEditorPage /></RequirePermission> },
          { path: "/govt-exam/:id",        element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><GovtExamEditorPage /></RequirePermission> },
          // Legacy Sarkari Naukri redirects → Govt Exam
          { path: "/sarkari-naukri",       element: <Navigate to="/govt-exam" replace /> },
          { path: "/sarkari-naukri/new",   element: <Navigate to="/govt-exam/new" replace /> },
          { path: "/sarkari-naukri/:id",   element: <Navigate to="/govt-exam" replace /> },
          // Entrance Exams (dedicated editorial workflow)
          { path: "/entrance-exams",       element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamListPage /></RequirePermission> },
          { path: "/entrance-exams/new",   element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/entrance-exams/:id",   element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          // Govt Vacancy (previously Sarkari Bharti)
          { path: "/govt-vacancy",         element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><SarkariBhartiListPage /></RequirePermission> },
          { path: "/govt-vacancy/new",     element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/govt-vacancy/:id",     element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          // Legacy routes (redirect to new)
          { path: "/sarkari-bharti",       element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><SarkariBhartiListPage /></RequirePermission> },
          { path: "/sarkari-bharti/new",   element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/sarkari-bharti/:id",   element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          // University Exams
          { path: "/university-exams",     element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><UniversityExamsListPage /></RequirePermission> },
          { path: "/university-exams/new", element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/university-exams/:id", element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          // Board Exams
          { path: "/board-exams",          element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><BoardExamsListPage /></RequirePermission> },
          { path: "/board-exams/new",      element: <RequirePermission anyOf={[P.CREATE_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/board-exams/:id",      element: <RequirePermission anyOf={[P.CREATE_EXAM, P.EDIT_ANY_EXAM]}><EntranceExamEditorPage /></RequirePermission> },
          { path: "/users",             element: <RequirePermission anyOf={[P.MANAGE_USERS]}><UsersListPage /></RequirePermission> },
          { path: "/settings",          element: <RequirePermission anyOf={[P.MANAGE_SETTINGS]}><SettingsPage /></RequirePermission> },
          { path: "/audit",             element: <RequirePermission anyOf={[P.VIEW_AUDIT_LOG]}><AuditLogPage /></RequirePermission> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
