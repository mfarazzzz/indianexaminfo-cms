# Changelog Guide

> How to document releases and maintain the project changelog.

---

## 1. Versioning

The project follows **Semantic Versioning** (semver):

```
MAJOR.MINOR.PATCH
```

| Increment | When |
|-----------|------|
| MAJOR | Breaking changes to the CMS interface, data model, or API |
| MINOR | New features, new modules, new capabilities |
| PATCH | Bug fixes, performance improvements, documentation |

### Current Version

The version is tracked in `package.json`:
```json
{
  "version": "0.1.0"
}
```

---

## 2. Changelog Format

Maintain a `CHANGELOG.md` in the project root using this format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Removed
- Removed features

### Security
- Security-related changes

### Deprecated
- Features being phased out

---

## [0.2.0] - 2026-07-20

### Added
- CMS Results module with full CRUD
- Education News module with bilingual support
- AI autofill for exam, content, and blog forms
- Bulk publish/archive operations

### Changed
- Entity editor now uses workspace tab layout
- Revalidation uses batched debounce strategy

### Fixed
- Slug conflicts on entity creation now auto-append year
- Auth context no longer signs out on transient DB errors

---

## [0.1.0] - 2026-07-01

### Added
- Initial CMS release
- Entity system with template-driven configuration
- Block-based content editing (14 block types)
- Timeline management with lifecycle rules
- Google Gemini AI integration
- Role-based access control (5 roles)
- Media library with Supabase Storage
- Frontend cache revalidation
```

---

## 3. Categories

Use these categories consistently:

| Category | What goes here |
|----------|---------------|
| **Added** | New features, new modules, new endpoints |
| **Changed** | Behavior changes, UI redesigns, refactors visible to users |
| **Fixed** | Bug fixes |
| **Removed** | Deleted features or deprecated items now gone |
| **Security** | Vulnerability fixes, auth changes, RLS policy updates |
| **Deprecated** | Features that will be removed in a future version |

---

## 4. Writing Good Changelog Entries

### Do

- Write from the user's perspective
- Be specific about what changed
- Include the module/area affected
- Link to related issues/PRs if available

### Don't

- Include internal refactoring invisible to users
- Use technical jargon without context
- Be vague ("various improvements")
- Include every single commit

### Examples

```markdown
# ✓ Good
- Add bulk publish action for Results module (select multiple → publish all)
- Fix timeline event not saving when publish_at date is today
- Change entity list to use cursor pagination (improves performance for large datasets)

# ✗ Bad
- Updated code
- Fixed bug
- Misc improvements
- Refactored entityService.ts internal mapRow function
```

---

## 5. Release Process

### 1. Prepare Release

```bash
# Update version in package.json
npm version minor  # or major/patch

# Update CHANGELOG.md
# Move [Unreleased] items to new version section
# Add date: ## [X.Y.Z] - YYYY-MM-DD
```

### 2. Create Release Commit

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main --tags
```

### 3. Create GitHub Release

- Title: `v0.2.0`
- Body: Copy changelog section for this version
- Attach build artifacts if applicable

### 4. Deploy

Follow [Deployment Guide](./DEPLOYMENT_GUIDE.md) release checklist.

---

## 6. Pre-1.0 Versioning

While the project is `< 1.0.0`:
- MINOR bumps may include breaking changes
- The API is not considered stable
- Changes are documented but migration guides are optional

After `1.0.0`:
- Breaking changes require MAJOR bump
- Migration guides are mandatory for breaking changes
- Deprecation notices must precede removal by at least one MINOR version

---

## 7. Automation (Future)

Consider automating changelog generation:
- Use conventional commits to auto-categorize
- Tools: `conventional-changelog`, `semantic-release`, `changesets`
- CI can block merges that lack proper commit message format
