# User Acceptance Testing (UAT) Checklist

> **Audience**: Content editors, admin staff, product owner  
> **Duration**: 1-2 hours per role  
> **Goal**: Verify the system meets editorial team's daily workflow needs

---

## Tester Information

| Field | Value |
|-------|-------|
| Tester Name | _______________ |
| Role Tested | _______________ |
| Date | _______________ |
| Browser | _______________ |
| Device | _______________ |

---

## Scenario 1: Editor Creates a New Exam Notification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Login as Editor | Dashboard loads | |
| 2 | Navigate to Exam Manager | Exam list visible | |
| 3 | Click "New Exam" | Empty editor form opens | |
| 4 | Fill: Name = "TEST Exam 2026" | Field accepts input | |
| 5 | Fill: Slug = "test-exam-2026" | Auto-generated or manual | |
| 6 | Select: Pillar = "sarkari-naukri" | Dropdown works | |
| 7 | Select: Category = "SSC" | Category saved | |
| 8 | Fill: Conducting Body = "SSC" | Accepted | |
| 9 | Fill: Status = "upcoming" | Saved | |
| 10 | Add Date: "Application Start" = future date | Date picker works | |
| 11 | Set: hasNotification = true | Toggle works | |
| 12 | Click "Save" | Success toast, exam in list | |
| 13 | Click "Publish" (change status) | Status updated | |
| 14 | Open frontend, search for "TEST Exam" | Exam visible (after cache refresh) | |
| 15 | Delete the test exam | Removed from list | |

---

## Scenario 2: Editor Creates a Sarkari Result Page

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Navigate to Sarkari Results | List loads (361 entries) | |
| 2 | Click "New Result" | Editor form opens | |
| 3 | Fill Title: "TEST Result 2026" | Accepted | |
| 4 | Fill Slug: "test-result-2026" | Validated (lowercase, hyphens) | |
| 5 | Fill Organization: "Test Org" | Accepted | |
| 6 | Set Result Date: today | Date picker works | |
| 7 | Set Category: "ssc" | Accepted | |
| 8 | Set Result Status: "declared" | Dropdown works | |
| 9 | Enter Description (HTML): `<h2>Test</h2><p>Content</p>` | HTML accepted | |
| 10 | Check "Featured" | Checkbox works | |
| 11 | Click "Save Draft" | Saved with status=draft | |
| 12 | Click "Publish" | Status → published, published_at set | |
| 13 | Navigate back to list | New entry visible at top | |
| 14 | Edit the entry, change title | Saves updated title | |
| 15 | Delete the test entry | Removed | |

---

## Scenario 3: Editor Creates Education News

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Navigate to Education News | List loads | |
| 2 | Click "New Article" | Form opens | |
| 3 | Fill Title, Slug, Category | Validated | |
| 4 | Fill Content with HTML | Accepted | |
| 5 | Mark as "Breaking News" | Flag saved | |
| 6 | Publish | Status → published | |
| 7 | Search for the article | Found | |
| 8 | Archive it | Status → archived | |
| 9 | Delete it | Removed | |

---

## Scenario 4: AI-Assisted Content Creation

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Open Exam Editor | Form loads | |
| 2 | Click "AI Auto-Fill" button | Dialog opens | |
| 3 | Paste raw notification text | Text area accepts input | |
| 4 | Click "Extract" / Submit | Loading indicator shown | |
| 5 | AI returns data | Form fields populated | |
| 6 | Review auto-filled data | Reasonable data (title, dates, etc.) | |
| 7 | Edit AI-suggested title | Edit is preserved | |
| 8 | Click Save | Saves the edited version | |
| 9 | Verify in DB | Record has all fields | |
| 10 | Compare to manual entry | Same DB structure | |

---

## Scenario 5: Admin Manages Users

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Login as Super Admin | Full access | |
| 2 | Navigate to Users | User list shows | |
| 3 | Invite new user (email + role) | Invitation sent | |
| 4 | Change existing user's role | Role updated | |
| 5 | Deactivate a user | Marked inactive | |
| 6 | Send password reset | Email sent | |

---

## Scenario 6: Frontend Verification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1 | Open homepage | All sections render | |
| 2 | Check year in headings | Shows 2026 | |
| 3 | Click Government Jobs tab | Filters work | |
| 4 | Click an exam → detail page | All info displayed | |
| 5 | Check breadcrumbs | Correct hierarchy | |
| 6 | Check mobile view (resize) | Responsive layout | |
| 7 | Check /sitemap.xml | Valid XML | |
| 8 | Check page source for meta tags | title, description, og present | |

---

## UAT Sign-off

| Question | Answer |
|----------|--------|
| Can editors create content without technical help? | Yes / No |
| Does the workflow match editorial team's process? | Yes / No |
| Is AI Auto-Fill useful and non-disruptive? | Yes / No |
| Are all published items visible on the frontend? | Yes / No |
| Are there any showstopper issues? | Yes / No (describe) |
| Overall satisfaction (1-5) | ___ |

**Approved for Production**: ☐ Yes  ☐ No  ☐ Conditionally

**Signature**: _______________  **Date**: _______________
