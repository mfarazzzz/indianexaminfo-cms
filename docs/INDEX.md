# Documentation Index

> IndianExamInfo CMS — Complete Engineering Knowledge Base

---

## Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Full technical architecture: frontend, backend, data flow, security, caching, block system, AI integration | Developer, AI Agent |
| [DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md) | Quick start, project conventions, core concepts, development workflow, common patterns | Developer (new) |
| [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) | Table schemas, ER diagrams, common queries, migration guidelines, RLS policies, performance notes | Developer, DevOps |
| [CMS_MODULE_GUIDE.md](./CMS_MODULE_GUIDE.md) | All CMS modules, routes, services, permissions. How to create new modules. | Developer |
| [CONTENT_LIFECYCLE.md](./CONTENT_LIFECYCLE.md) | Content flow from creation to publication, archival, deletion. Workflow states, revalidation, revisions. | Developer, Editor, AI Agent |
| [AI_INTEGRATION_GUIDE.md](./AI_INTEGRATION_GUIDE.md) | Gemini integration, prompt architecture, autofill, configuration, extension points, cost optimization | Developer, AI Agent |
| [API_REFERENCE.md](./API_REFERENCE.md) | All service methods with parameters, return types, errors, and usage | Developer, AI Agent |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Dev/staging/production setup, build process, PM2/Nginx config, CI/CD, release checklist | DevOps, Developer |
| [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | Incident response for outages, DB failures, AI failures, storage issues, performance degradation | DevOps, Administrator |
| [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) | Common problems and solutions: build failures, connection issues, permissions, uploads, search | Developer, DevOps |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Folder structure, naming, component conventions, service patterns, TypeScript rules, testing | Developer, AI Agent |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branching, commits, PRs, code review, testing requirements, definition of done | Developer |
| [CHANGELOG_GUIDE.md](./CHANGELOG_GUIDE.md) | Semantic versioning, changelog format, release process | Developer, DevOps |

---

## Diagrams

| Diagram | Description |
|---------|-------------|
| [diagrams/architecture-overview.md](./diagrams/architecture-overview.md) | High-level system architecture and data flow (Mermaid) |
| [diagrams/content-lifecycle.md](./diagrams/content-lifecycle.md) | Workflow state machine, content source flow, revalidation sequence (Mermaid) |
| [diagrams/entity-relationships.md](./diagrams/entity-relationships.md) | ER diagrams for all database domains (Mermaid) |

---

## Examples

| Example | Description |
|---------|-------------|
| [examples/new-block-type.md](./examples/new-block-type.md) | Step-by-step: adding a "Code Snippet" block to the block system |
| [examples/new-service.md](./examples/new-service.md) | Step-by-step: adding a complete "Scholarships" CMS module |
| [examples/ai-prompt-template.md](./examples/ai-prompt-template.md) | Step-by-step: adding an AI comparison generator |

---

## Related Project Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture Rules | `/ARCHITECTURE.md` | Canonical architecture rules (10 sections) |
| CMS Single Source of Truth | `/CMS_SINGLE_SOURCE_OF_TRUTH.md` | Content flow enforcement rules |
| QA Checklists | `/qa/` | Master QA, regression, smoke test, UAT checklists |
| CI Configuration | `/.github/workflows/ci.yml` | GitHub Actions pipeline |

---

## Audience Guide

### New Developer
Start with: DEVELOPER_HANDBOOK → CODING_STANDARDS → SYSTEM_ARCHITECTURE

### DevOps Engineer
Start with: DEPLOYMENT_GUIDE → OPERATIONS_RUNBOOK → TROUBLESHOOTING_GUIDE

### Content Editor (technical)
Start with: CONTENT_LIFECYCLE → CMS_MODULE_GUIDE

### AI Agent / Coding Assistant
Start with: SYSTEM_ARCHITECTURE → API_REFERENCE → CODING_STANDARDS → AI_INTEGRATION_GUIDE

### Administrator
Start with: OPERATIONS_RUNBOOK → TROUBLESHOOTING_GUIDE → DEPLOYMENT_GUIDE

---

## Documentation Gaps & Future Enhancements

| Gap | Priority | Notes |
|-----|----------|-------|
| E2E test documentation | Medium | Playwright setup and critical path tests |
| Performance benchmarks | Low | Baseline metrics for key operations |
| API rate limiting guide | Low | If/when rate limiting is added |
| Multi-tenancy guide | Low | If the CMS is ever white-labeled |
| Internationalization guide | Medium | When Hindi UI is added |
| WebSocket/Realtime guide | Low | When collaborative editing is added |
| Backup recovery playbook | Medium | Detailed Supabase PITR procedures |
| Security audit procedures | Medium | Periodic RLS policy review |
| Load testing guide | Low | When traffic warrants it |
| Plugin development SDK | Low | If third-party plugins are supported |

---

## Maintenance

- **Last updated:** July 2026
- **Versioned with code:** Documentation lives in `/docs/` and is version-controlled alongside source code
- **Update triggers:** Update docs when architecture changes, new modules are added, or deployment procedures change
- **Review cadence:** Quarterly review for accuracy
