# Test Cases — IndianExamInfo CMS

> **Total**: 312 Test Cases  
> **Format**: ID | Module | Feature | Preconditions | Steps | Expected | Severity

---

## 1. Authentication & RBAC (AUTH-001 to AUTH-015)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| AUTH-001 | Login with valid credentials | Valid admin account exists | 1. Open /login 2. Enter email/password 3. Click Login | Dashboard loads, user name shown in top bar | Critical |
| AUTH-002 | Login with invalid password | Valid email, wrong password | 1. Open /login 2. Enter valid email + wrong password 3. Click Login | Error message "Invalid credentials" displayed | Critical |
| AUTH-003 | Login with non-existent email | — | 1. Open /login 2. Enter fake@email.com 3. Click Login | Error message displayed, no crash | Critical |
| AUTH-004 | Logout | Logged in as any user | 1. Click user avatar/menu 2. Click Logout | Redirected to /login, session cleared | Critical |
| AUTH-005 | Access protected route without auth | Not logged in | 1. Navigate directly to /dashboard | Redirected to /login | Critical |
| AUTH-006 | Access /exams as Editor | Logged in as Editor role | 1. Navigate to /exams | Page loads, Create button visible | High |
| AUTH-007 | Access /users as Author | Logged in as Author role | 1. Navigate to /users | Page not accessible OR shows permission denied | High |
| AUTH-008 | Access /settings as Author | Logged in as Author role | 1. Navigate to /settings | Not accessible | High |
| AUTH-009 | Session persistence on refresh | Logged in | 1. Refresh browser | Still logged in, no re-auth required | High |
| AUTH-010 | Session expiry | Logged in, token expired | 1. Wait for token expiry (or manually clear) 2. Try an action | Redirected to login gracefully | Medium |
| AUTH-011 | Password reset request | Valid email exists | 1. Click "Forgot Password" 2. Enter email 3. Submit | Success message shown | Medium |
| AUTH-012 | Invite new user (Admin) | Logged in as Admin | 1. Go to /users 2. Click Invite 3. Enter email + role | Invitation sent successfully | High |
| AUTH-013 | Change user role (Admin) | Logged in as Admin, target user exists | 1. Go to /users 2. Change role dropdown 3. Save | Role updated, reflected on reload | High |
| AUTH-014 | Deactivate user (Admin) | Logged in as Admin | 1. Go to /users 2. Click deactivate on a user | User marked inactive | Medium |
| AUTH-015 | Multiple tabs same session | Logged in | 1. Open CMS in 2 tabs 2. Edit in one, navigate in other | Both tabs work without conflicts | Low |

---

## 2. Dashboard (DASH-001 to DASH-008)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| DASH-001 | Dashboard loads | Logged in | 1. Navigate to /dashboard | Stats cards show counts for exams, posts, blogs | High |
| DASH-002 | Exam count accurate | Exams exist in DB | 1. Check exam count on dashboard | Matches actual count in /exams list | High |
| DASH-003 | Recent activity shows | Content recently updated | 1. Check "Recent Activity" section | Shows latest 3 exams, content, blogs with timestamps | Medium |
| DASH-004 | Review count badge | Content posts in "review" status | 1. Check review count in top bar | Shows correct count of items pending review | Medium |
| DASH-005 | Quick navigation links | — | 1. Click each dashboard quick-link | Navigates to correct page | Medium |
| DASH-006 | Dashboard responsive | — | 1. Resize browser to mobile width | Cards stack vertically, no overflow | Low |
| DASH-007 | Dashboard with empty DB | No content exists | 1. Login (fresh setup) | Shows 0 counts, no errors | Low |
| DASH-008 | Dashboard performance | 100+ exams exist | 1. Navigate to dashboard | Loads in < 2 seconds | Medium |

---

## 3. Exam Manager (EXAM-001 to EXAM-022)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| EXAM-001 | List all exams | Exams exist | 1. Navigate to /exams | Table shows exams with name, status, category, date | Critical |
| EXAM-002 | Search exams | Exams exist | 1. Type "UPSC" in search box | Only UPSC-related exams shown | High |
| EXAM-003 | Filter by pillar | Mixed pillars exist | 1. Select "sarkari-naukri" filter | Only govt job exams shown | High |
| EXAM-004 | Filter by status | Mixed statuses | 1. Select "active" status filter | Only active exams shown | High |
| EXAM-005 | Create new exam | Logged in as Editor+ | 1. Click "New Exam" 2. Fill required fields 3. Save | Exam created, appears in list | Critical |
| EXAM-006 | Create exam - validation | — | 1. Click Save with empty required fields | Validation errors shown per field | High |
| EXAM-007 | Create exam - duplicate slug | Exam with slug "test" exists | 1. Create exam with slug "test" | Error: slug already exists | High |
| EXAM-008 | Edit existing exam | Exam exists | 1. Click edit on exam 2. Change name 3. Save | Name updated, reflected in list | Critical |
| EXAM-009 | Publish exam | Draft exam exists | 1. Open draft exam 2. Change status to active 3. Save | Status shows "active" | Critical |
| EXAM-010 | Delete exam | Exam exists, Admin role | 1. Click delete icon 2. Confirm | Exam removed from list | High |
| EXAM-011 | Delete exam - unauthorized | Logged as Author | 1. Try to delete exam | Action blocked / not available | High |
| EXAM-012 | Add important dates | Editing exam | 1. Add 3 dates with labels 2. Save | Dates saved and displayed | High |
| EXAM-013 | Add eligibility info | Editing exam | 1. Fill age, qualification, nationality 2. Save | Eligibility section saved | Medium |
| EXAM-014 | Add application fee | Editing exam | 1. Fill fee for General, OBC, SC, ST 2. Save | Fee table saved | Medium |
| EXAM-015 | Toggle featured | Exam exists | 1. Click star/featured toggle 2. Save | is_featured updated | Medium |
| EXAM-016 | Content type flags | Editing exam | 1. Toggle hasAdmitCard, hasResult etc. 2. Save | Flags saved correctly | High |
| EXAM-017 | Tags input | Editing exam | 1. Add tags "upsc, ias, 2026" 2. Save | Tags saved as array | Medium |
| EXAM-018 | SEO fields | Editing exam | 1. Fill seo_title, seo_description 2. Save | SEO fields persisted | Medium |
| EXAM-019 | FAQs | Editing exam | 1. Add 2 FAQ items 2. Save | FAQs saved as JSON array | Medium |
| EXAM-020 | AI Auto-Fill | Editing exam | 1. Click AI Auto-Fill 2. Paste notification text 3. Accept | Form fields populated automatically | High |
| EXAM-021 | Exam appears on frontend | Exam published | 1. Publish exam 2. Check frontend | Exam card visible on homepage/listing | Critical |
| EXAM-022 | Exam detail page works | Exam published | 1. Click exam card on frontend | Detail page renders with all info | Critical |

---

## 4. Sarkari Results (RES-001 to RES-020)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| RES-001 | List all results | Results exist (361) | 1. Navigate to /results | Table shows results with title, status, org, date | Critical |
| RES-002 | Search results | — | 1. Type "UPSC" in search | Filtered to UPSC results only | High |
| RES-003 | Filter by status | Mixed statuses | 1. Select "published" | Only published shown | High |
| RES-004 | Filter by category | Mixed categories | 1. Select "anganwadi" | Only anganwadi results shown | High |
| RES-005 | Create new result | Editor+ role | 1. Click "New Result" 2. Fill title, slug, org, date 3. Save Draft | Created with status "draft" | Critical |
| RES-006 | Slug validation | — | 1. Enter slug with spaces/uppercase | Validation error: lowercase hyphens only | High |
| RES-007 | Duplicate slug prevention | Slug "test" exists | 1. Create with slug "test" | Error message: slug already in use | High |
| RES-008 | Edit existing result | Result exists | 1. Click edit 2. Change description 3. Save | Updated successfully | Critical |
| RES-009 | Publish result | Draft result | 1. Click "Publish" button | Status → published, published_at set | Critical |
| RES-010 | Archive result | Published result | 1. Change status to "archived" 2. Save | Status → archived | High |
| RES-011 | Delete result | Admin role | 1. Click delete 2. Confirm | Removed from list | High |
| RES-012 | Featured toggle | Result exists | 1. Check "Featured" checkbox 2. Save | is_featured = true in DB | Medium |
| RES-013 | Hindi fields | Editing result | 1. Fill title_hindi, org_hindi 2. Save | Hindi fields persisted | Medium |
| RES-014 | Result link URL validation | — | 1. Enter invalid URL 2. Save | Validation error on result_link | Medium |
| RES-015 | Cutoff marks field | Editing result | 1. Enter "Gen: 95, OBC: 88" 2. Save | Text persisted | Low |
| RES-016 | Total candidates number | — | 1. Enter 1500000 2. Save | Number saved correctly | Low |
| RES-017 | Pass percentage | — | 1. Enter 12.5 2. Save | Decimal saved | Low |
| RES-018 | Bulk publish | Multiple draft results | 1. Select 5 results 2. Click Bulk Publish | All 5 status → published | Medium |
| RES-019 | Created metadata | New result created via CMS | 1. Create result 2. Check DB | created_by has user UUID, created_at = now | High |
| RES-020 | Legacy record editable | Record with created_by=NULL | 1. Open legacy result 2. Edit title 3. Save | Saves successfully, shows "System (legacy import)" in metadata | High |

---

## 5. Education News (NEWS-001 to NEWS-018)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| NEWS-001 | List all news | News exist (41) | 1. Navigate to /education-news | Table with title, status, category, source | Critical |
| NEWS-002 | Search news | — | 1. Type "IBPS" in search | Filtered results | High |
| NEWS-003 | Filter by category | — | 1. Select "banking" | Only banking news shown | High |
| NEWS-004 | Create news article | Editor+ | 1. Click "New Article" 2. Fill fields 3. Save | Created in draft | Critical |
| NEWS-005 | Slug validation | — | 1. Bad slug format | Error message | High |
| NEWS-006 | Edit existing news | Article exists | 1. Click edit 2. Modify content 3. Save | Updated | Critical |
| NEWS-007 | Publish news | Draft article | 1. Click Publish | Status → published, published_at set | Critical |
| NEWS-008 | Archive news | Published | 1. Set archived status 2. Save | Archived | High |
| NEWS-009 | Delete news | Admin | 1. Delete 2. Confirm | Removed | High |
| NEWS-010 | Breaking news flag | — | 1. Check "Breaking News" 2. Save | is_breaking = true | Medium |
| NEWS-011 | Important flag | — | 1. Check "Important" 2. Save | is_important = true | Medium |
| NEWS-012 | Featured flag | — | 1. Check "Featured" 2. Save | is_featured = true | Medium |
| NEWS-013 | HTML content | — | 1. Enter HTML in content field 2. Save | HTML preserved correctly | High |
| NEWS-014 | Source and source link | — | 1. Fill source name + URL 2. Save | Both fields saved | Medium |
| NEWS-015 | Author field | — | 1. Enter author name 2. Save | Saved | Low |
| NEWS-016 | Hindi content | — | 1. Fill title_hindi, content_hindi 2. Save | Hindi fields saved | Medium |
| NEWS-017 | Category required | — | 1. Leave category empty 2. Try save | Validation: category required | High |
| NEWS-018 | Legacy record editable | created_by=NULL record | 1. Open 2. Edit 3. Save | Works without error | High |

---

## 6. Blog Posts (BLOG-001 to BLOG-018)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| BLOG-001 | List blogs | Posts exist | 1. Navigate to /blog | Table with posts | Critical |
| BLOG-002 | Create blog post | Editor+ | 1. New 2. Fill title, slug, section, content 3. Save | Created | Critical |
| BLOG-003 | Section selection | — | 1. Select "education-news" section | Saved to correct section | High |
| BLOG-004 | Post type | — | 1. Select "guide" type | Saved | Medium |
| BLOG-005 | Rich content | — | 1. Enter long HTML content 2. Save | Preserved | High |
| BLOG-006 | Tags | — | 1. Add tags 2. Save | Array saved | Medium |
| BLOG-007 | Related exams | — | 1. Search and link exam 2. Save | Slug array updated | Medium |
| BLOG-008 | Author assignment | Authors exist | 1. Select author 2. Save | author_id set | Medium |
| BLOG-009 | SEO fields | — | 1. Fill seo_title, seo_description 2. Save | Persisted | Medium |
| BLOG-010 | FAQs | — | 1. Add FAQ items 2. Save | JSON array saved | Medium |
| BLOG-011 | Publish | Draft post | 1. Publish | Status → published, published_at set | Critical |
| BLOG-012 | Unpublish | Published post | 1. Change to "unpublished" 2. Save | No longer visible on frontend | High |
| BLOG-013 | Delete | Admin | 1. Delete post | Removed | High |
| BLOG-014 | AI Auto-Fill blog | — | 1. AI button 2. Paste text 3. Accept | Form populated with generated content | High |
| BLOG-015 | Frontend sync | Published | 1. Publish 2. Check frontend /blog/{section}/{slug} | Page renders | Critical |
| BLOG-016 | Breaking flag | — | 1. Toggle breaking 2. Save | Flag saved | Low |
| BLOG-017 | Featured flag | — | 1. Toggle 2. Save | Saved | Low |
| BLOG-018 | Table of contents | — | 1. Content with H2/H3 headers | ToC generated (if implemented) | Low |

---

## 7. AI Features (AI-001 to AI-018)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| AI-001 | AI Auto-Fill with raw text | API key configured | 1. Open Exam Editor 2. Click AI Auto-Fill 3. Paste notification text 4. Wait | Fields populated from extracted data | High |
| AI-002 | AI Auto-Fill with JSON | — | 1. Paste valid JSON into AI dialog | Instantly fills form (no API call) | High |
| AI-003 | AI Auto-Fill invalid JSON | — | 1. Paste `{broken json` | Falls through to API call or shows error | Medium |
| AI-004 | AI with no API key | gemini_api_key empty in settings | 1. Try AI Auto-Fill | Error: "API key not configured. Go to Settings." | High |
| AI-005 | AI rate limited | — | 1. Make 10+ rapid AI calls | Error message about rate limit, not crash | Medium |
| AI-006 | AI timeout | Network slow | 1. Try AI with poor connection | Timeout error, form unchanged | Medium |
| AI-007 | AI empty response | Gemini returns empty | 1. Paste minimal text | Error: "Empty AI response" | Medium |
| AI-008 | AI fills but user edits before save | — | 1. AI fills form 2. User changes title 3. Save | User's edit preserved, not overwritten | High |
| AI-009 | AI for Content Post | — | 1. Open Content Post editor 2. AI Auto-Fill 3. Paste admit card text | Content type fields populated | High |
| AI-010 | AI for Blog | — | 1. Open Blog editor 2. AI Auto-Fill 3. Paste topic | Blog fields + content generated | High |
| AI-011 | AI does NOT write to database | — | 1. Use AI 2. Close dialog without saving | No record created in DB | Critical |
| AI-012 | AI-filled record indistinguishable | — | 1. Create manually 2. Create via AI 3. Compare | Same fields, same workflow, same DB structure | High |
| AI-013 | AI SEO generation (if available) | — | 1. Fill title 2. Click "Generate SEO" | seo_title and seo_description populated | Medium |
| AI-014 | AI description generation | — | 1. Click "Generate Description" | Excerpt/description populated | Medium |
| AI-015 | Gemini model selection | Settings page | 1. Change model to "gemini-1.5-pro" 2. Save 3. Use AI | Uses new model | Low |
| AI-016 | AI toggle disabled | ai_enabled = false in settings | 1. Try AI buttons | Buttons disabled or hidden | Medium |
| AI-017 | AI usage tracking | AI used | 1. Use AI 2. Check cms_ai_usage table | Usage logged | Low |
| AI-018 | AI cancel mid-generation | AI loading | 1. Start AI 2. Click Cancel/Close before complete | No partial data, form unchanged | Medium |

---

## 8. Frontend Sync (FE-001 to FE-020)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| FE-001 | Homepage loads | Exams published | 1. Open frontend root / | Homepage with exam cards renders | Critical |
| FE-002 | Sarkari Naukri section | Sarkari exams exist | 1. Check "Government Jobs" section | Shows featured exams with correct category tabs | Critical |
| FE-003 | Entrance Exam section | Entrance exams exist | 1. Check "Entrance Exams" section | Shows JEE, NEET etc. | Critical |
| FE-004 | Board & University section | Board exams exist | 1. Check section | Shows CBSE, UP Board etc. | Critical |
| FE-005 | Exam card → detail page | Published exam | 1. Click any exam card | Correct detail page opens with all data | Critical |
| FE-006 | Category page | Category has exams | 1. Visit /sarkari-naukri/banking | Banking exams listed | High |
| FE-007 | Content type sub-page | Exam has hasResult=true | 1. Visit /sarkari-naukri/{cat}/{slug}/result | Result page renders | High |
| FE-008 | Blog listing | Published blogs | 1. Visit /blog | Blog posts listed | High |
| FE-009 | Blog detail | Published post | 1. Visit /blog/{section}/{slug} | Full article renders | High |
| FE-010 | Search works | Data exists | 1. Visit /search?q=SSC | Exam and content results shown | High |
| FE-011 | Admit Card hub | Exams with hasAdmitCard | 1. Visit /admit-card | List of exams with admit cards | High |
| FE-012 | Results hub | Exams with hasResult | 1. Visit /results | List of exams with results | High |
| FE-013 | 404 handling | — | 1. Visit /nonexistent-page | Custom 404 page, not crash | High |
| FE-014 | Year display correct | Current year 2026 | 1. Check any page heading | Shows 2026, NOT 2025 | Critical |
| FE-015 | Breadcrumbs correct | Exam detail page | 1. Check breadcrumb | Home > Pillar > Category > Exam | Medium |
| FE-016 | Mobile responsive | — | 1. View on 375px width | Cards stack, nav collapses, no overflow | High |
| FE-017 | Cache revalidation | CMS has revalidate button | 1. Edit exam in CMS 2. Click Revalidate 3. Check frontend | Updated content visible | High |
| FE-018 | Static pages | /about exists | 1. Visit /about | Page content renders | Medium |
| FE-019 | RSS feed | — | 1. Visit /api/feed | Valid RSS XML returned | Low |
| FE-020 | Sitemap | — | 1. Visit /sitemap.xml | Valid sitemap with all exam URLs | High |

---

## 9. SEO (SEO-001 to SEO-018)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| SEO-001 | Homepage meta title | — | 1. View page source | `<title>` contains "IndianExamInfo" + year | High |
| SEO-002 | Exam page meta | Published exam | 1. View source of exam detail | `<title>` has exam name + year | High |
| SEO-003 | Canonical URL | Any page | 1. View source | `<link rel="canonical">` points to correct URL | High |
| SEO-004 | Open Graph tags | Any page | 1. View source | og:title, og:description, og:image present | High |
| SEO-005 | Twitter Card tags | Any page | 1. View source | twitter:card, twitter:title present | Medium |
| SEO-006 | robots.txt | — | 1. Visit /robots.txt | Valid robots.txt with sitemap reference | High |
| SEO-007 | Sitemap completeness | 125 exams published | 1. Parse /sitemap.xml | All exam URLs present | High |
| SEO-008 | JSON-LD on exam page | — | 1. View source of exam page | Script type="application/ld+json" with JobPosting/Event schema | High |
| SEO-009 | FAQ schema | Exam with FAQs | 1. View source | FAQPage schema present | Medium |
| SEO-010 | Breadcrumb schema | Detail page | 1. View source | BreadcrumbList schema present | Medium |
| SEO-011 | No index for draft | Draft/unpublished page | 1. Attempt to access | Not indexed, or 404 | High |
| SEO-012 | Slug in URL matches DB | Any exam | 1. Compare URL slug to DB slug | Exact match | Critical |
| SEO-013 | No duplicate content | Same exam | 1. Check with/without trailing slash | One canonical, other redirects | Medium |
| SEO-014 | Image alt text | Exam cards | 1. Inspect images | Alt text present (not empty) | Medium |
| SEO-015 | Heading hierarchy | Any page | 1. Check headings | Single H1, proper H2-H6 nesting | Medium |
| SEO-016 | Page speed insights | Homepage | 1. Run PageSpeed Insights | Score > 70 (mobile) | Medium |
| SEO-017 | Redirect /exam/:slug | Old URL pattern | 1. Visit /exam/ssc-cgl | Redirects to /sarkari-naukri/ssc-cgl | High |
| SEO-018 | 404 returns 404 status | — | 1. Visit /asdfjkl 2. Check HTTP status | Status code 404, not 200 | High |

---

## 10. Security (SEC-001 to SEC-020)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| SEC-001 | No API keys in page source | — | 1. View frontend source 2. Search for "AIza" or "eyJ" (service key) | No service role keys exposed (anon key is OK) | Critical |
| SEC-002 | RLS blocks anonymous writes | Not logged in | 1. Try POST to Supabase API directly | 403 or policy violation error | Critical |
| SEC-003 | Published-only public read | Unpublished exam exists | 1. Query exams API without auth | Only published records returned | Critical |
| SEC-004 | XSS in content fields | — | 1. Enter `<script>alert(1)</script>` in title 2. Save 3. View on frontend | Script NOT executed, escaped or sanitized | Critical |
| SEC-005 | CSRF protection | — | 1. Submit form from external origin | Blocked (Supabase uses JWT, not cookies for API) | High |
| SEC-006 | SQL injection in search | — | 1. Search with `'; DROP TABLE exams; --` | No error, no data loss, treated as text | Critical |
| SEC-007 | File upload validation | Media upload | 1. Try to upload .exe file | Rejected, only image/PDF allowed | High |
| SEC-008 | Large file upload | — | 1. Upload 100MB file | Rejected with size limit error | Medium |
| SEC-009 | CSP header present | — | 1. Check response headers | Content-Security-Policy header set | High |
| SEC-010 | X-Frame-Options | — | 1. Check headers | SAMEORIGIN | High |
| SEC-011 | HSTS header | — | 1. Check headers | Strict-Transport-Security present | Medium |
| SEC-012 | No sensitive data in errors | Trigger error | 1. Cause a 500 error | No DB credentials or stack traces shown to user | High |
| SEC-013 | Rate limiting | — | 1. Make 100 rapid requests to search API | Rate limited or handled gracefully | Medium |
| SEC-014 | Environment variables not exposed | — | 1. Check browser network tab | No VITE_ env vars with secrets in client bundle | High |
| SEC-015 | Revalidation token required | — | 1. Call /api/revalidate without token | 401 Unauthorized | High |
| SEC-016 | User cannot escalate own role | Logged as Author | 1. Try to change own role via API | Blocked | High |
| SEC-017 | Deleted user cannot login | User deactivated | 1. Try login | Blocked | High |
| SEC-018 | Image URLs not guessable | — | 1. Check media URLs | Uses unique hashes, not sequential IDs | Low |
| SEC-019 | No directory listing | — | 1. Visit /public/ or /_next/ | No file listing exposed | Medium |
| SEC-020 | HTTPS enforced | Production | 1. Try HTTP | Redirects to HTTPS | Critical |

---

## 11. Performance (PERF-001 to PERF-015)

| ID | Feature | Preconditions | Steps | Expected | Severity |
|----|---------|--------------|-------|----------|----------|
| PERF-001 | Dashboard load time | — | 1. Navigate to /dashboard 2. Measure | < 2 seconds | Medium |
| PERF-002 | Exam list with 125 items | 125 exams | 1. Open /exams | Loads in < 1.5 seconds | Medium |
| PERF-003 | Results list with 361 items | 361 results | 1. Open /results | Loads in < 2 seconds | Medium |
| PERF-004 | Search response time | — | 1. Type in search 2. Measure response | Results in < 500ms | Medium |
| PERF-005 | Editor load time | Complex exam | 1. Open exam editor | Form renders in < 1.5 seconds | Medium |
| PERF-006 | Save operation | Large content | 1. Edit large description 2. Save | Saves in < 2 seconds | Medium |
| PERF-007 | Frontend homepage | — | 1. Load homepage 2. LCP | LCP < 2.5 seconds | High |
| PERF-008 | Frontend exam detail | — | 1. Load exam page | Full render < 1.5 seconds | Medium |
| PERF-009 | Bulk publish 50 results | 50 drafts selected | 1. Bulk publish | Completes in < 10 seconds | Medium |
| PERF-010 | Bulk delete 10 results | 10 selected | 1. Bulk delete | Completes in < 5 seconds | Medium |
| PERF-011 | Sitemap generation | 125 exams | 1. Load /sitemap.xml | Generates in < 3 seconds | Low |
| PERF-012 | Image upload | 2MB image | 1. Upload | Completes in < 5 seconds | Low |
| PERF-013 | AI Auto-Fill | — | 1. Trigger AI 2. Measure | Response in < 10 seconds | Low |
| PERF-014 | Frontend with 10,000 exams (projected) | — | 1. Estimated based on query patterns | Pagination handles gracefully | Low |
| PERF-015 | No N+1 queries | — | 1. Check network tab on list pages | Single query per table, not per-row | Medium |

---

## 12. Cross-Browser & Responsive (XBROWSER-001 to XBROWSER-020)

| ID | Feature | Browser/Device | Steps | Expected | Severity |
|----|---------|---------------|-------|----------|----------|
| XBROWSER-001 | CMS Login | Chrome Desktop | 1. Login | Works | High |
| XBROWSER-002 | CMS Login | Firefox Desktop | 1. Login | Works | High |
| XBROWSER-003 | CMS Login | Edge Desktop | 1. Login | Works | Medium |
| XBROWSER-004 | CMS Login | Safari Desktop | 1. Login | Works | Medium |
| XBROWSER-005 | CMS Editor | Chrome Desktop | 1. Create/Edit exam | All form fields work | High |
| XBROWSER-006 | CMS Editor | Firefox Desktop | 1. Create/Edit exam | Works | Medium |
| XBROWSER-007 | Frontend Homepage | Chrome Mobile (375px) | 1. Load homepage | Cards stack, no overflow | High |
| XBROWSER-008 | Frontend Homepage | Safari iOS | 1. Load homepage | Renders correctly | High |
| XBROWSER-009 | Frontend Exam Detail | Chrome Mobile | 1. Open exam detail | Tables scroll horizontally, content readable | High |
| XBROWSER-010 | Frontend Search | Mobile Chrome | 1. Use search | Keyboard opens, results show | Medium |
| XBROWSER-011 | CMS Sidebar | Tablet (768px) | 1. Check sidebar | Collapses to hamburger or adapts | Medium |
| XBROWSER-012 | CMS Sidebar | Mobile (375px) | 1. Check sidebar | Hidden by default, opens on tap | Medium |
| XBROWSER-013 | Frontend Navigation | Desktop (1920px) | 1. Check mega menu | Full navigation visible | High |
| XBROWSER-014 | Frontend Navigation | Mobile (375px) | 1. Check nav | Mobile hamburger menu | High |
| XBROWSER-015 | CMS Tables | Tablet landscape | 1. View exam list | Table scrolls or adapts | Medium |
| XBROWSER-016 | Frontend Cards | Tablet portrait | 1. View homepage | 2-column grid | Medium |
| XBROWSER-017 | AI Dialog | Mobile | 1. Open AI Auto-Fill | Dialog usable on small screen | Low |
| XBROWSER-018 | Form Inputs | iOS Safari | 1. Fill form on mobile | Date pickers, selects work | Medium |
| XBROWSER-019 | Frontend Print | Chrome Print | 1. Ctrl+P on exam page | Clean print layout | Low |
| XBROWSER-020 | Dark Mode (if supported) | — | 1. Check system dark mode | Doesn't break layout | Low |
