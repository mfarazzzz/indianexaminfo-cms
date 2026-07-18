# Contributing Guide

> How to contribute to the IndianExamInfo CMS project.

---

## 1. Getting Started

1. Clone the repository and set up your development environment (see [Developer Handbook](./DEVELOPER_HANDBOOK.md))
2. Read the [Architecture Rules](../ARCHITECTURE.md) — violations require senior approval
3. Read the [Coding Standards](./CODING_STANDARDS.md)
4. Pick an issue or discuss your proposed change before starting

---

## 2. Branching Strategy

### Branches

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready code | Yes |
| `develop` | Integration branch (if used) | Yes |
| `feature/*` | New features | No |
| `fix/*` | Bug fixes | No |
| `refactor/*` | Code improvements | No |
| `docs/*` | Documentation changes | No |

### Workflow

```
main ← PR ← feature/my-feature
```

1. Create branch from `main`
2. Make changes
3. Push and create Pull Request
4. CI must pass
5. Code review required
6. Merge via squash

---

## 3. Commit Conventions

Use conventional commits:

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling changes |
| `perf` | Performance improvement |
| `style` | Formatting (no logic change) |

### Examples

```
feat(entity): add bulk export to CSV
fix(timeline): prevent past dates in publish_at field
refactor(services): extract mapRow into shared utility
docs: add deployment guide
test(modules): add unit tests for duplicateModule
```

---

## 4. Pull Request Process

### Before Opening a PR

- [ ] Code compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] No console.log statements in production code
- [ ] New features have basic tests

### PR Title Format

Same as commit convention:
```
feat(entity): add CSV export capability
```

### PR Description Template

```markdown
## What
Brief description of changes.

## Why
Motivation and context.

## How
Technical approach (if non-obvious).

## Testing
How this was tested.

## Screenshots
(If UI changes)
```

### PR Size Guidelines

- Ideal: < 200 lines
- Maximum: 400 lines (excluding generated files, tests)
- If larger, split into multiple PRs

---

## 5. Code Review Expectations

### For Authors

- Respond to all review comments
- Explain non-obvious decisions in code comments
- Don't force-push during review (makes re-review hard)
- Mark resolved conversations

### For Reviewers

Focus on:
1. **Correctness** — Does it work? Edge cases?
2. **Architecture compliance** — Does it follow ARCHITECTURE.md rules?
3. **Service layer** — Is Supabase access only in services?
4. **Type safety** — Are types explicit and correct?
5. **Error handling** — Are errors propagated, not swallowed?
6. **Security** — Input validation, no hardcoded secrets?

Don't bike-shed on:
- Minor formatting (ESLint handles this)
- Personal style preferences
- Theoretical edge cases unlikely in production

---

## 6. Testing Requirements

### New Features Must Include

- Unit tests for service functions
- Component test for primary UI interaction (save, error)
- Integration test if touching multiple services

### Bug Fixes Should Include

- Regression test that reproduces the bug
- The test should fail before the fix and pass after

### Test Quality

- Test behavior, not implementation
- Use meaningful test names (describe what, not how)
- Mock external dependencies (Supabase, Gemini API)
- Avoid testing React internals

---

## 7. Definition of Done

A feature is considered done when:

- [ ] Code is implemented and working
- [ ] TypeScript types are complete (no `any`)
- [ ] Zod validation schema covers all inputs
- [ ] Service layer handles all data access
- [ ] Error states are handled in the UI
- [ ] Tests cover the happy path and primary error case
- [ ] All CI checks pass
- [ ] PR is approved by at least one reviewer
- [ ] Documentation is updated (if API/behavior changed)
- [ ] No `console.log` or debugging code remains

---

## 8. Architecture Decision Records

Major architectural changes should be documented as ADRs:

```markdown
# ADR-XXX: [Title]

## Status: Proposed / Accepted / Deprecated

## Context
What prompted this decision?

## Decision
What we decided and why.

## Consequences
What are the trade-offs?
```

Existing ADRs are referenced in `ARCHITECTURE.md` (ADR-001, ADR-003, ADR-005, ADR-007, ADR-011, ADR-015).

---

## 9. Communication

### Before Starting Large Work

- Open a discussion issue describing the change
- Tag relevant reviewers for input
- Get alignment on approach before writing code

### During Development

- Push work-in-progress branches for visibility
- Ask questions early — don't spend days on a wrong path
- Update the issue with progress notes

### After Completion

- Close related issues with the merge commit
- Update documentation if behavior changed
- Announce significant changes to the team

---

## 10. Release Process

See [Changelog Guide](./CHANGELOG_GUIDE.md) for version numbering and release documentation.

Releases follow:
1. Feature branch merged to main
2. CI passes on main
3. Tagged release created
4. Production deployment
5. Post-deployment verification
6. Changelog updated
