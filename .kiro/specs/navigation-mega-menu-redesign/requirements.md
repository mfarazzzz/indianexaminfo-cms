# Requirements Document

## Introduction

A complete Navigation Architecture and Mega Menu redesign for IndianExamInfo, transforming the current 3-pillar static navigation into a modern, scalable 6-domain application navigation system. This redesign encompasses Information Architecture (IA), Taxonomy, CMS Menu Management, Dynamic Routing, and a modern mega menu UI inspired by Notion, Stripe Docs, Vercel, Linear, and Microsoft Learn. The navigation becomes the foundational system for website navigation, CMS management, search, internal linking, SEO landing pages, AI recommendations, breadcrumbs, related content, category pages, and future mobile app.

## Glossary

- **Navigation_System**: The complete navigation infrastructure including data model, API layer, frontend components, and CMS management interface
- **Mega_Menu**: A full-width overlay navigation panel with multi-column layout containing categories, sub-categories, popular items, trending items, and search functionality
- **Pillar**: A top-level knowledge domain (e.g., government-exam, government-jobs, entrance-exam, university-exam, board-exam, news)
- **Taxonomy_Node**: A single node in the hierarchical taxonomy tree representing a category, sub-category, collection, or item
- **Navigation_Tree**: The hierarchical data structure representing the complete navigation taxonomy with parent-child relationships
- **CMS_Menu_Manager**: The admin interface within the CMS for creating, editing, reordering, and publishing navigation menus
- **Navigation_Panel**: The desktop mega menu overlay component with left sidebar categories, middle sub-categories panel, and right contextual panel
- **Mobile_Drawer**: The responsive mobile navigation component using accordion/sheet patterns for progressive disclosure
- **Quick_Access_Bar**: A sticky secondary navigation bar below the main header displaying shortcut links
- **Discovery_Facet**: A cross-cutting dimension for content discovery (e.g., by State, Qualification, Stream, Department, Organisation)
- **Navigation_API**: The server-side data layer that resolves navigation trees, handles caching, and serves menu data to the frontend
- **Route_Resolver**: The system that maps taxonomy nodes to SEO-friendly URL paths and generates dynamic routes
- **Breadcrumb_Generator**: The component that produces hierarchical breadcrumb trails based on the navigation tree position
- **Content_Taxonomy**: The relationship mapping between content items (exams, jobs, news) and their position in the navigation hierarchy
- **Static_Navigation_Mode**: Navigation rendered from build-time static data with no runtime API calls
- **Dynamic_Navigation_Mode**: Navigation rendered from CMS-managed data fetched at request time or via ISR

## Requirements

### Requirement 1: Taxonomy Data Model

**User Story:** As a CMS administrator, I want a scalable hierarchical taxonomy data model, so that I can represent 6 independent knowledge domains with unlimited nesting depth and cross-domain relationships.

#### Acceptance Criteria

1. THE Navigation_System SHALL support exactly 6 top-level Pillars: government-exam, government-jobs, entrance-exam, university-exam, board-exam, and news
2. THE Navigation_System SHALL store Taxonomy_Nodes in a tree structure supporting a minimum of 5 nesting levels (Pillar → Category → Sub-Category → Collection → Item)
3. WHEN a Taxonomy_Node is created, THE Navigation_System SHALL assign a unique slug, parent reference, pillar association, display order, and active status
4. THE Navigation_System SHALL support multiple Discovery_Facets per Taxonomy_Node including state, qualification, stream, degree, department, organisation, university, board, course, selection-process, admission-mode, exam-mode, frequency, and status
5. WHEN a Taxonomy_Node is deactivated, THE Navigation_System SHALL exclude the node and all descendant nodes from navigation rendering while preserving the data
6. THE Navigation_System SHALL enforce unique slug constraints within each Pillar scope
7. THE Navigation_System SHALL store metadata per Taxonomy_Node including icon, badge, description, SEO fields, featured-item references, and custom display properties

### Requirement 2: Navigation Tree Resolution

**User Story:** As a frontend developer, I want efficient tree resolution APIs, so that I can render the complete navigation hierarchy without N+1 queries or performance issues.

#### Acceptance Criteria

1. WHEN the frontend requests a Pillar navigation tree, THE Navigation_API SHALL return the complete hierarchy including all active descendant nodes in a single response within 100ms (cached)
2. THE Navigation_API SHALL cache resolved navigation trees with a configurable TTL defaulting to 60 minutes
3. WHEN a Taxonomy_Node is updated in the CMS, THE Navigation_API SHALL invalidate the affected Pillar cache within 5 seconds
4. THE Navigation_API SHALL support both Static_Navigation_Mode and Dynamic_Navigation_Mode with identical response shapes
5. WHEN operating in Static_Navigation_Mode, THE Navigation_System SHALL serve navigation data from a pre-built JSON file generated at build time
6. WHEN operating in Dynamic_Navigation_Mode, THE Navigation_System SHALL fetch navigation data from Supabase via ISR with stale-while-revalidate caching
7. THE Navigation_API SHALL return pre-computed item counts per Taxonomy_Node to avoid runtime aggregation queries

### Requirement 3: Desktop Mega Menu Component

**User Story:** As a website visitor, I want a modern application-style mega menu, so that I can efficiently discover and navigate to any content within a knowledge domain.

#### Acceptance Criteria

1. WHEN a user hovers over a primary navigation item for more than 60ms, THE Navigation_Panel SHALL open with a smooth fade-in animation completing within 200ms
2. THE Navigation_Panel SHALL display a three-column layout: left sidebar with top-level categories, middle panel with sub-categories for the selected category, and right panel with contextual content (popular, trending, recently updated, featured items)
3. THE Navigation_Panel SHALL include a search input at the top that filters navigation items within the active Pillar in real-time as the user types
4. WHEN a user selects a category in the left sidebar, THE Navigation_Panel SHALL update the middle and right panels within 50ms without closing the menu
5. THE Navigation_Panel SHALL display pinned/featured categories at the top of the left sidebar, visually distinguished from regular categories
6. THE Navigation_Panel SHALL display a "View All" link at the bottom of each panel section linking to the corresponding category landing page
7. THE Navigation_Panel SHALL render item counts, badges (popular, new, updated, trending), and icons for each navigation item
8. WHEN the user presses Escape or clicks outside the panel, THE Navigation_Panel SHALL close with a fade-out animation within 150ms
9. THE Navigation_Panel SHALL support keyboard navigation with arrow keys for moving between items and Enter for selection
10. THE Navigation_Panel SHALL display a "Latest Updates" section at the bottom showing the 3 most recent notifications or updates for the active Pillar

### Requirement 4: Mobile Navigation Component

**User Story:** As a mobile user, I want a responsive navigation drawer, so that I can browse the full navigation hierarchy on small screens with progressive disclosure.

#### Acceptance Criteria

1. WHEN the viewport width is below 1024px, THE Navigation_System SHALL replace the desktop mega menu with the Mobile_Drawer component
2. WHEN the user taps the mobile menu toggle, THE Mobile_Drawer SHALL slide in from the left with a spring animation completing within 300ms
3. THE Mobile_Drawer SHALL display Pillars as top-level accordion items that expand to reveal categories on tap
4. WHEN a category is tapped in the Mobile_Drawer, THE Mobile_Drawer SHALL expand the category to show sub-categories using progressive disclosure (one level at a time)
5. THE Mobile_Drawer SHALL include a search input at the top that searches across all Pillars
6. THE Mobile_Drawer SHALL display a "Quick Links" section showing frequently accessed items (Admit Cards, Results, Answer Keys, Latest Jobs)
7. WHEN the Mobile_Drawer is open, THE Navigation_System SHALL prevent background page scrolling
8. THE Mobile_Drawer SHALL support swipe-to-close gesture from left to right

### Requirement 5: CMS Menu Management Interface

**User Story:** As a CMS editor, I want a visual menu management interface, so that I can create, reorder, and publish navigation structures without developer intervention.

#### Acceptance Criteria

1. THE CMS_Menu_Manager SHALL provide a drag-and-drop tree editor for creating and reordering Taxonomy_Nodes within each Pillar
2. WHEN a CMS editor creates a new Taxonomy_Node, THE CMS_Menu_Manager SHALL require label, slug, parent selection, and Pillar assignment, and optionally accept icon, badge, description, SEO title, SEO description, and featured items
3. THE CMS_Menu_Manager SHALL support bulk operations including bulk activate, bulk deactivate, bulk move (re-parent), and bulk reorder
4. WHEN a CMS editor publishes navigation changes, THE CMS_Menu_Manager SHALL trigger cache invalidation and optionally regenerate the static navigation JSON file
5. THE CMS_Menu_Manager SHALL display a live preview of the mega menu rendering for the selected Pillar
6. THE CMS_Menu_Manager SHALL maintain a revision history for navigation changes with the ability to rollback to any previous version
7. THE CMS_Menu_Manager SHALL validate that all required fields are populated and slugs are unique within the Pillar before allowing publish
8. THE CMS_Menu_Manager SHALL support assigning Discovery_Facets to Taxonomy_Nodes (state, qualification, stream, etc.)

### Requirement 6: SEO Route Generation

**User Story:** As an SEO specialist, I want navigation-driven route generation, so that every taxonomy node automatically produces an optimized landing page URL.

#### Acceptance Criteria

1. THE Route_Resolver SHALL generate SEO-friendly URLs following the pattern: /{pillar}/{category}/{sub-category}/{item}
2. WHEN a new Taxonomy_Node is published, THE Route_Resolver SHALL automatically register the corresponding route in the Next.js App Router
3. THE Route_Resolver SHALL generate a sitemap entry for each active Taxonomy_Node with appropriate priority and change frequency
4. THE Breadcrumb_Generator SHALL produce a hierarchical breadcrumb trail matching the Taxonomy_Node path from Pillar to current node
5. THE Route_Resolver SHALL support URL aliases and redirects for renamed or moved Taxonomy_Nodes to prevent broken links
6. WHEN a Taxonomy_Node URL matches content type sub-routes, THE Route_Resolver SHALL support nested patterns such as /{pillar}/{category}/{item}/{content-type} (e.g., /government-exam/ssc/ssc-cgl/syllabus)
7. THE Route_Resolver SHALL generate JSON-LD structured data (BreadcrumbList schema) for each resolved route

### Requirement 7: Cross-Domain Discovery System

**User Story:** As a website visitor, I want to discover content across multiple dimensions, so that I can find relevant exams, jobs, and information regardless of which knowledge domain they belong to.

#### Acceptance Criteria

1. THE Navigation_System SHALL support global Discovery_Facets that span across all Pillars: by State (36 states/UTs), by Qualification (10th, 12th, Graduate, Post-Graduate, PhD), by Stream (Science, Commerce, Arts, Engineering, Medical, Law), by Department, and by Organisation
2. WHEN a user selects a Discovery_Facet value, THE Navigation_System SHALL display aggregated results from all relevant Pillars sorted by relevance
3. THE Navigation_System SHALL generate SEO landing pages for each Discovery_Facet combination (e.g., /browse/state/uttar-pradesh, /browse/qualification/graduate)
4. THE Navigation_System SHALL surface trending items, recently updated items, and popular items across each Pillar in dedicated sections of the mega menu right panel
5. THE Navigation_System SHALL support "Related Content" resolution by finding Taxonomy_Nodes sharing common Discovery_Facet values with the current page

### Requirement 8: Government Exams Domain Structure

**User Story:** As a competitive exam aspirant, I want to navigate government exams by category and access all related content types, so that I can find preparation materials and updates for any government exam.

#### Acceptance Criteria

1. THE Navigation_System SHALL organize Government Exams into primary categories: Civil Services, SSC Exams, Banking Exams, Railway Exams, Defence Exams, Teaching Eligibility, Higher Education Eligibility, Professional Certification, State PSC, State Eligibility Tests, Recruitment Boards, and Other Competitive Exams
2. WHEN a user navigates to a specific exam within Government Exams, THE Navigation_System SHALL provide access to content types: Overview, Notification, Admit Card, Answer Key, Result, Cut Off, Preparation, Books, Previous Papers, Eligibility, Exam Pattern, Syllabus, and FAQs
3. THE Navigation_System SHALL display the most recently updated exams in the Government Exams mega menu right panel as "Latest Updates"
4. THE Navigation_System SHALL mark categories with active notifications or upcoming exam dates with a visual "urgent" indicator

### Requirement 9: Government Jobs Domain Structure

**User Story:** As a job seeker, I want to discover government job vacancies through multiple navigation paths, so that I can find relevant recruitment notifications regardless of how I prefer to search.

#### Acceptance Criteria

1. THE Navigation_System SHALL support discovery of Government Jobs by Job Type categories including: Police, Teaching, Engineering, Healthcare, Judiciary, Revenue, Administrative, Clerical, Technical, Defence, PSU, Apprenticeship, Contract, Walk-in, Direct Recruitment, Research, Agriculture, Energy, Transport, Municipal, Forest, Fire Services, Home Guards, Anganwadi, ASHA, Cooperative, Public Sector, State Government, and Central Government
2. THE Navigation_System SHALL support deep sub-categories within each Job Type (e.g., Police → Constable, Head Constable, Sub-Inspector, Inspector, DSP, Fireman, Jail Warder, Home Guard)
3. THE Navigation_System SHALL display vacancy count aggregates at the category level showing total open positions
4. THE Navigation_System SHALL surface jobs with approaching deadlines (application closing within 7 days) in the mega menu as "Closing Soon" items

### Requirement 10: Entrance Exams Domain Structure

**User Story:** As a student seeking admission, I want to browse entrance exams by scope and field of study, so that I can identify the right exam for my target institution or course.

#### Acceptance Criteria

1. THE Navigation_System SHALL organize Entrance Exams by scope: National, State, University, Private, and International
2. THE Navigation_System SHALL categorize Entrance Exams by field: Engineering, Medical, Management, Law, Design, Architecture, Agriculture, Education, Polytechnic, University Entrance Tests, Private University Entrance, and Admission Without Entrance
3. THE Navigation_System SHALL support dual classification of an Entrance Exam (both by scope and by field) without duplication in the data model
4. THE Navigation_System SHALL display upcoming exam dates in the mega menu for entrance exams with registration currently open

### Requirement 11: University Exams Domain Structure

**User Story:** As a university student, I want to navigate university exams by university type and access exam-related resources, so that I can find results, date sheets, and previous papers for my university.

#### Acceptance Criteria

1. THE Navigation_System SHALL organize Universities by type: Central, State, Private, Open, Distance, Deemed, Technical, Agricultural, Medical, Law, Women's, and Minority
2. WHEN a user navigates to a specific university, THE Navigation_System SHALL expose sub-navigation for: Admissions, Courses, Entrance, Semester/Annual Exams, Results, Academic Calendar, Previous Papers, Syllabus, Date Sheet, Fees, Placements, and Scholarships
3. THE Navigation_System SHALL support associating multiple Taxonomy_Nodes (courses, exams) under a single university parent node
4. THE Navigation_System SHALL display recently declared results in the University Exams mega menu right panel

### Requirement 12: Board Exams Domain Structure

**User Story:** As a board exam student or parent, I want to navigate board exams by board type and access all relevant resources, so that I can find results, date sheets, and study materials for my specific board and class.

#### Acceptance Criteria

1. THE Navigation_System SHALL organize Board Exams by type: National Boards (CBSE, CISCE, NIOS), State Boards (30+ individual state boards), Open Boards, Technical Boards, Sanskrit Boards, and Madarsa Boards
2. WHEN a user navigates to a specific board, THE Navigation_System SHALL expose sub-navigation for: Class 10, Class 12, Results, Date Sheet, Admit Card, Compartment, Revaluation, Syllabus, Sample Papers, and Previous Papers
3. THE Navigation_System SHALL support individual state board entries for each of the 30+ Indian state boards
4. THE Navigation_System SHALL highlight boards with recently declared results or upcoming date sheets in the mega menu

### Requirement 13: News Domain Structure

**User Story:** As a reader following education news, I want to browse news by category and topic, so that I can stay updated on specific areas of interest.

#### Acceptance Criteria

1. THE Navigation_System SHALL organize News into categories: Latest News, Government Exams, Government Jobs, Entrance Exams, Admissions, Results, Answer Keys, Counselling, Scholarships, University News, Board News, Education Policy, UGC, AICTE, NTA, NCERT, NEP, Career Guidance, Preparation, Study Tips, Success Stories, Opinion, Editorial, Explainers, Rankings, and International Education
2. THE Navigation_System SHALL display the 5 most recent breaking or featured news items in the News mega menu
3. THE Navigation_System SHALL support cross-linking news articles to related exams, jobs, and institutions via Taxonomy_Node references
4. WHEN a news category has new articles published within the last 24 hours, THE Navigation_System SHALL display a "new" badge on that category in the mega menu

### Requirement 14: Navigation Performance

**User Story:** As a website visitor, I want instant navigation rendering, so that I experience no delay when browsing the mega menu on any device or connection speed.

#### Acceptance Criteria

1. THE Navigation_System SHALL render the initial navigation header within 50ms of page load using server-side rendered static data
2. WHEN the mega menu opens, THE Navigation_System SHALL display the first panel content within 16ms (single frame) using pre-loaded data
3. THE Navigation_System SHALL lazy-load secondary panel content (right panel trending/popular items) only when the corresponding category is selected or hovered
4. THE Navigation_System SHALL keep the total navigation JavaScript bundle below 30KB gzipped
5. THE Navigation_System SHALL use skeleton loading states for any asynchronously loaded navigation content
6. IF a navigation API request fails, THEN THE Navigation_System SHALL fall back to the last known static navigation data without displaying an error to the user
7. THE Navigation_System SHALL prefetch adjacent Pillar navigation data when the user hovers over a primary navigation item for more than 200ms

### Requirement 15: Accessibility Compliance

**User Story:** As a user with disabilities, I want the navigation to be fully accessible, so that I can navigate the site using assistive technologies.

#### Acceptance Criteria

1. THE Navigation_System SHALL conform to WCAG 2.1 Level AA for all navigation components
2. THE Navigation_Panel SHALL implement proper ARIA roles (navigation, menu, menuitem, menubar) and states (aria-expanded, aria-haspopup, aria-current)
3. THE Navigation_System SHALL support complete keyboard navigation: Tab for focus movement, Arrow keys for item traversal, Enter/Space for activation, and Escape for closing
4. THE Navigation_System SHALL maintain a visible focus indicator with a minimum 3:1 contrast ratio against adjacent colors
5. THE Navigation_System SHALL announce navigation panel open/close events to screen readers via aria-live regions
6. THE Navigation_System SHALL ensure all interactive elements have a minimum touch target size of 44x44 CSS pixels on mobile
7. THE Navigation_System SHALL provide text alternatives for all icon-only navigation elements

### Requirement 16: Sticky Navigation Behavior

**User Story:** As a website visitor scrolling through content, I want the navigation to remain accessible, so that I can navigate to other sections without scrolling back to the top.

#### Acceptance Criteria

1. THE Navigation_System SHALL render the primary navigation header as a sticky element fixed to the top of the viewport during scroll
2. THE Quick_Access_Bar SHALL remain sticky below the primary header, becoming visible after the user has scrolled past the hero section
3. WHEN the user scrolls down more than 100px, THE Navigation_System SHALL apply a compact mode reducing the header height from 56px to 48px with a smooth transition
4. WHEN the mega menu is open and the user scrolls, THE Navigation_System SHALL close the mega menu to prevent content overlap
5. THE Navigation_System SHALL ensure the combined sticky header height does not exceed 96px to preserve content viewport space

### Requirement 17: Navigation Search Integration

**User Story:** As a website visitor, I want to search within navigation contexts, so that I can quickly find specific exams, jobs, or content without browsing through the full hierarchy.

#### Acceptance Criteria

1. WHEN a user types in the mega menu search input, THE Navigation_System SHALL filter and display matching Taxonomy_Nodes from the active Pillar within 100ms of keystroke
2. THE Navigation_System SHALL support fuzzy matching for search queries accounting for common misspellings and abbreviations (e.g., "upsc" matching "Union Public Service Commission")
3. THE Navigation_System SHALL display recent searches (last 5) and popular searches (top 10) when the search input receives focus
4. WHEN search results are displayed, THE Navigation_System SHALL group results by category and display the full taxonomy path for each result
5. THE Navigation_System SHALL index Taxonomy_Node labels, aliases, keywords, and associated content titles for search matching
6. IF no results match the search query within the active Pillar, THEN THE Navigation_System SHALL suggest results from other Pillars with a "Also found in..." label

### Requirement 18: Static and Dynamic Mode Switching

**User Story:** As a developer, I want the navigation to support both static and CMS-driven modes, so that I can maintain performance during the CMS transition period.

#### Acceptance Criteria

1. THE Navigation_System SHALL support a configuration flag to switch between Static_Navigation_Mode and Dynamic_Navigation_Mode without code changes
2. WHEN operating in Static_Navigation_Mode, THE Navigation_System SHALL read navigation data from a JSON file bundled at build time with zero runtime API calls
3. WHEN operating in Dynamic_Navigation_Mode, THE Navigation_System SHALL fetch navigation data from the CMS API using ISR with a configurable revalidation interval
4. THE Navigation_System SHALL provide a CLI command or CMS action to export the current CMS navigation state to the static JSON format for build-time bundling
5. THE Navigation_System SHALL ensure identical rendering output regardless of which mode is active
6. WHEN transitioning from Static_Navigation_Mode to Dynamic_Navigation_Mode, THE Navigation_System SHALL preserve all existing routes and URL structures without breaking changes
