# Implementation Plan: AI Provider Management

## Overview

Replace the ad-hoc AI key management with a dedicated `ai_providers` table, admin UI, provider-agnostic fallback wrapper with retry logic, and request logging. Implementation proceeds from database schema up through service layer, adapters, fallback logic, backward-compatible migration, admin UI, health dashboard, data migration, and cleanup.

## Tasks

- [ ] 1. Database schema setup
  - [ ] 1.1 Create ai_providers table with constraints, triggers, and RLS policies
    - Create the `ai_providers` table with all columns (id, provider, label, api_key, model, is_enabled, priority, last_used_at, last_error, usage_count, created_at, updated_at)
    - Add CHECK constraint on provider enum values (groq, gemini, cerebras, mistral, openrouter)
    - Add UNIQUE constraint on (provider, label)
    - Create auto-priority trigger (`trg_ai_providers_auto_priority`)
    - Create updated_at trigger (`trg_ai_providers_updated_at`)
    - Add RLS policies restricting access to authenticated admin users
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.2 Create ai_request_logs table with indexes and RLS policies
    - Create `ai_request_logs` table with columns (id, provider_id FK, prompt_hash, status, error_message, latency_ms, consumer_name, created_at)
    - Add CHECK constraint on status enum (success, error)
    - Create indexes on created_at DESC and provider_id
    - Add RLS policies for admin read access
    - _Requirements: 8.1, 8.2_

- [ ] 2. TypeScript types and provider service
  - [ ] 2.1 Create TypeScript type definitions for AI providers
    - Create `src/types/aiProvider.ts` with types: AIProviderName, AIProvider, AIProviderInsert, AIProviderUpdate, AIRequestLog
    - Map snake_case DB columns to camelCase TS fields
    - _Requirements: 1.1_

  - [ ] 2.2 Implement AI provider service with CRUD operations
    - Create `src/services/aiProviderService.ts`
    - Implement `getAllProviders()`, `getEnabledProviders()` (ordered by priority ASC)
    - Implement `createProvider()`, `updateProvider()`, `deleteProvider()`
    - Implement `updateProviderPriorities()` for drag-and-drop reordering
    - Implement `recordProviderSuccess()` and `recordProviderError()`
    - Implement `getRecentLogs()`, `insertRequestLog()`, `getDashboardStats()`
    - Include `mapProviderRow()` helper for snake_case to camelCase mapping
    - _Requirements: 1.1, 2.3, 2.4, 2.5, 2.6, 3.6, 3.7, 7.4, 8.1_

  - [ ]* 2.3 Write unit tests for provider service mapping and stats logic
    - Test `mapProviderRow` correctly maps all fields
    - Test `getDashboardStats` aggregation
    - Test priority reordering produces correct update sequence
    - _Requirements: 1.1, 2.6, 7.4_

- [ ] 3. Provider adapter pattern
  - [ ] 3.1 Create adapter interface and shared error class
    - Create `src/lib/ai/adapters/types.ts` with `AdapterRequest`, `AdapterResponse`, `ProviderAdapter` interface, and `AdapterError` class
    - Implement `isRetryable` getter on AdapterError (429, 413, 5xx → true; 401, 403, 404 → false)
    - _Requirements: 4.1, 3.3, 3.4_

  - [ ] 3.2 Implement OpenAI-compatible adapter
    - Create `src/lib/ai/adapters/openai-compatible.ts`
    - Support Groq (api.groq.com), Cerebras (api.cerebras.ai), Mistral (api.mistral.ai), OpenRouter (openrouter.ai/api) via configurable base URL
    - Set 30-second timeout via AbortController
    - Set default temperature 0.7, max_tokens 4096
    - Throw AdapterError with status code on non-OK responses
    - _Requirements: 4.2, 4.5, 4.6_

  - [ ] 3.3 Implement Gemini native adapter
    - Create `src/lib/ai/adapters/gemini.ts`
    - Call Google Generative Language API with x-goog-api-key header and generateContent endpoint
    - Set 30-second timeout via AbortController
    - Set default temperature 0.7, maxOutputTokens 8192
    - Throw AdapterError with status code on non-OK responses
    - _Requirements: 4.3, 4.5, 4.6_

  - [ ]* 3.4 Write property tests for adapter routing and error classification
    - **Property 9: Adapter routing correctness** — verify gemini → GeminiAdapter, all others → OpenAICompatibleAdapter with correct base URL
    - **Property 10: Default generation parameters** — verify OpenAI-compatible uses max_tokens=4096, Gemini uses maxOutputTokens=8192, both use temperature=0.7
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.6**

- [ ] 4. Fallback wrapper implementation
  - [ ] 4.1 Implement fallback wrapper with priority-based key chain and retry logic
    - Create `src/lib/ai/fallbackWrapper.ts`
    - Implement `generateWithFallback(prompt, consumerName)` that retrieves enabled keys ordered by priority ASC
    - Attempt each key in priority order: on retryable error (429, 413, 5xx), move to next key; on non-retryable error (401, 403, 404), throw immediately
    - On success: update key metadata (last_used_at, usage_count) and insert request log (fire-and-forget)
    - On error: record last_error on key and insert request log (fire-and-forget)
    - If all keys fail: throw error with "All configured AI keys failed"
    - Implement `hashPrompt()` using SHA-256 via SubtleCrypto
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.5_

  - [ ]* 4.2 Write property test for fallback ordering and traversal
    - **Property 6: Fallback ordering and traversal** — verify keys are attempted in ascending priority order, retryable errors advance to next key
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 4.3 Write property test for non-retryable error short-circuit
    - **Property 7: Non-retryable error short-circuit** — verify 401/403/404 stops all further attempts immediately
    - **Validates: Requirements 3.4**

  - [ ]* 4.4 Write property test for logging failure resilience
    - **Property 15: Logging failure resilience** — verify that if insertRequestLog throws, the AI response is still returned
    - **Validates: Requirements 8.5**

- [ ] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Backward-compatible client.ts migration
  - [ ] 6.1 Update src/lib/gemini/client.ts to route through fallback wrapper
    - Modify `generateWithGemini` to first check for enabled providers in ai_providers table
    - If providers exist: route through `generateWithFallback` ignoring passed key params
    - If no providers exist or fallback system errors: fall back to passed key parameters (legacy behavior)
    - Preserve the existing `listAvailableModels` export unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property test for backward-compatible fallback behavior
    - **Property 12: Backward-compatible fallback behavior** — verify that when ai_providers has enabled keys, passed parameters are ignored; when table is empty, passed parameters are used
    - **Validates: Requirements 6.2, 6.4**

- [ ] 7. Admin UI — Provider management
  - [ ] 7.1 Create AIProviderList component with drag-and-drop reordering
    - Create `src/components/settings/AIProviderList.tsx`
    - Display list of all providers with: provider name, label, masked API key (first 4 + last 4), model, enabled/disabled switch, priority order
    - Implement drag-and-drop reordering using @dnd-kit/sortable
    - Include edit, delete, and test action buttons per row
    - Implement `maskApiKey()` utility function
    - _Requirements: 2.1, 2.6, 2.8_

  - [ ] 7.2 Create AIProviderForm component for add/edit operations
    - Create `src/components/settings/AIProviderForm.tsx`
    - Add mode: provider selection dropdown, label, API key, model fields
    - Edit mode: pre-filled form with label, API key, model, enabled status
    - Form validation using react-hook-form + zod
    - On submit: call createProvider or updateProvider service methods
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 7.3 Implement delete confirmation and test button functionality
    - Delete: show confirmation dialog (Radix AlertDialog), on confirm call deleteProvider
    - Test: send lightweight prompt using the specific key's adapter, display inline success/error
    - _Requirements: 2.5, 2.7_

  - [ ]* 7.4 Write property test for API key masking
    - **Property 4: API key masking** — verify that for any key length > 8, only first 4 and last 4 chars are visible
    - **Validates: Requirements 2.1**

- [ ] 8. Health dashboard and request logs view
  - [ ] 8.1 Create AIHealthDashboard component
    - Create `src/components/settings/AIHealthDashboard.tsx`
    - Display provider table with columns: provider, label, status indicator (green/red based on last_error), last_used_at, last_error, usage_count
    - Show summary stats: total requests (sum of usage_count) and enabled key count
    - Add refresh button to reload data from ai_providers table
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.2 Create RequestLogsTable component
    - Create `src/components/settings/RequestLogsTable.tsx`
    - Display 20 most recent log entries with columns: timestamp, provider label, status, latency_ms, consumer_name
    - Format timestamps relative (e.g., "2 min ago") and latency in ms
    - _Requirements: 8.3_

  - [ ] 8.3 Integrate AI provider management into Settings page
    - Add AI Providers tab/section to the existing settings page
    - Wire up AIProviderList, AIProviderForm, AIHealthDashboard, and RequestLogsTable
    - Use @tanstack/react-query for data fetching and cache invalidation
    - _Requirements: 2.1, 7.1, 8.3_

- [ ] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Data migration and log retention
  - [ ] 10.1 Create migration script to move existing settings keys to ai_providers
    - Read gemini_api_key, ai_fallback_key, ai_key_3 from settings table
    - Detect provider from key prefix (gsk_ → groq, AIza → gemini)
    - Insert with priorities 1, 2, 3 and labels "Primary (migrated)", "Fallback 1 (migrated)", "Fallback 2 (migrated)"
    - Preserve model values from gemini_model and ai_fallback_model settings
    - Skip keys that are empty or missing without error
    - Use ON CONFLICT DO NOTHING for idempotency
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 10.2 Implement request log retention cleanup (30-day TTL)
    - Create SQL function or scheduled mechanism to delete logs older than 30 days
    - Can be implemented as lazy cleanup on dashboard load or via pg_cron
    - _Requirements: 8.4_

  - [ ]* 10.3 Write property test for provider detection from key prefix
    - **Property 11: Provider detection from key prefix** — verify gsk_ → groq, AIza → gemini
    - **Validates: Requirements 5.2**

- [ ] 11. Clean up old AI settings UI
  - [ ] 11.1 Remove old AI key inputs from settings page
    - Remove the old gemini_api_key, ai_fallback_key, ai_key_3 settings fields from the settings UI
    - Keep the settings table rows intact (for rollback safety) but hide them from the admin interface
    - Add a note or redirect pointing to the new AI Providers section
    - _Requirements: 6.3_

- [ ] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project already has `fast-check`, `vitest`, and `@dnd-kit` dependencies installed
- All adapters use `fetch` (browser-native) — no additional HTTP library needed
- Fire-and-forget pattern (`.catch(() => {})`) used for logging to satisfy Requirement 8.5

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4", "8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["11.1"] }
  ]
}
```
