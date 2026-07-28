# Requirements Document

## Introduction

Multi-Provider AI Key Management System for the IndianExamInfo CMS. This feature replaces the current ad-hoc key management (three hardcoded settings: `gemini_api_key`, `ai_fallback_key`, `ai_key_3`) with a dedicated `ai_providers` table, an admin management UI, a provider-agnostic fallback wrapper with retry logic, and request logging. The system supports Groq, Gemini, Cerebras, Mistral, and OpenRouter providers through an adapter pattern, and all existing AI consumers continue to work without interface changes.

## Glossary

- **AI_Provider_System**: The subsystem responsible for storing, managing, and selecting AI provider keys for use in content generation
- **Fallback_Wrapper**: The provider-agnostic orchestration layer that walks enabled keys in priority order and retries on transient errors
- **Provider_Adapter**: A module that translates a unified request interface into a provider-specific API call (OpenAI-compatible or Gemini-native)
- **Admin_UI**: The settings interface within the CMS where administrators manage AI provider keys
- **Health_Dashboard**: The monitoring view that displays provider key statuses, errors, and usage statistics
- **Request_Log**: A record of each AI API call including which provider/key served the request and its outcome
- **Priority_Order**: The numeric ordering that determines which enabled key the Fallback_Wrapper tries first
- **Retryable_Error**: An HTTP error with status code 429 (rate limit), 413 (payload too large), or 5xx (server error) that triggers fallback to the next key

## Requirements

### Requirement 1: AI Providers Data Schema

**User Story:** As an administrator, I want AI provider keys stored in a dedicated database table, so that keys can be managed independently with metadata like priority, usage tracking, and error state.

#### Acceptance Criteria

1. THE AI_Provider_System SHALL store each provider key record with fields: id (UUID primary key), provider (enum: groq, gemini, cerebras, mistral, openrouter), label (user-defined name), api_key (text), model (text), is_enabled (boolean default true), priority (integer), last_used_at (timestamp), last_error (text), usage_count (integer default 0), created_at (timestamp), and updated_at (timestamp).
2. THE AI_Provider_System SHALL enforce a unique constraint on the combination of provider and label fields.
3. THE AI_Provider_System SHALL automatically set created_at on insert and updated_at on every modification.
4. THE AI_Provider_System SHALL restrict the provider field to the values: groq, gemini, cerebras, mistral, openrouter.
5. WHEN a new key is inserted without a priority value, THE AI_Provider_System SHALL assign a priority value equal to the current maximum priority plus one.

### Requirement 2: Admin Key Management UI

**User Story:** As an administrator, I want a dedicated UI to add, edit, delete, reorder, enable/disable, and test AI provider keys, so that I can manage all keys from a single interface.

#### Acceptance Criteria

1. THE Admin_UI SHALL display a list view of all AI provider keys showing: provider name, label, masked API key (first 4 and last 4 characters visible), model, enabled/disabled status, and priority order.
2. WHEN the administrator clicks the add button, THE Admin_UI SHALL display a form with fields for provider selection, label, API key, and model.
3. WHEN the administrator submits the add form with valid data, THE Admin_UI SHALL insert the new key record into the ai_providers table and refresh the list view.
4. WHEN the administrator clicks the edit button on a key row, THE Admin_UI SHALL display a pre-filled edit form allowing modification of label, API key, model, and enabled status.
5. WHEN the administrator clicks the delete button on a key row, THE Admin_UI SHALL prompt for confirmation and upon confirmation remove the key record from the ai_providers table.
6. WHEN the administrator drags a key row to a new position, THE Admin_UI SHALL update the priority values of all affected rows to reflect the new ordering.
7. WHEN the administrator clicks the test button on a key row, THE Admin_UI SHALL send a lightweight test prompt to the provider using that specific key and display the result (success or error message) inline.
8. WHEN the administrator toggles the enable/disable switch on a key row, THE Admin_UI SHALL update the is_enabled field for that key in the ai_providers table.

### Requirement 3: Provider-Agnostic Fallback Wrapper

**User Story:** As a developer, I want a single function that handles provider selection, fallback, and retry logic, so that AI consumers do not need to manage keys or handle provider-specific errors.

#### Acceptance Criteria

1. WHEN an AI generation request is made, THE Fallback_Wrapper SHALL retrieve all enabled keys from the ai_providers table ordered by priority (ascending).
2. THE Fallback_Wrapper SHALL attempt the AI request using the highest-priority enabled key first.
3. WHEN a Retryable_Error occurs (HTTP 429, 413, or 5xx), THE Fallback_Wrapper SHALL log the error against the key record and attempt the request with the next enabled key in priority order.
4. WHEN a non-retryable error occurs (HTTP 401, 403, or 404), THE Fallback_Wrapper SHALL record the error against the key, skip remaining fallback attempts, and throw the error to the caller.
5. IF all enabled keys return Retryable_Errors, THEN THE Fallback_Wrapper SHALL throw an error indicating all configured AI keys failed.
6. WHEN a key successfully serves a request, THE Fallback_Wrapper SHALL update the key record with the current timestamp in last_used_at and increment usage_count by one.
7. WHEN a key returns an error, THE Fallback_Wrapper SHALL store the error message in the key record's last_error field.

### Requirement 4: Provider Adapter Pattern

**User Story:** As a developer, I want provider-specific API communication abstracted behind adapters, so that adding new providers requires only implementing a new adapter without modifying the fallback logic.

#### Acceptance Criteria

1. THE Provider_Adapter SHALL define a unified interface accepting: prompt (string), api_key (string), and model (string), returning a response string.
2. THE Provider_Adapter SHALL implement an OpenAI-compatible adapter that supports Groq (base URL: api.groq.com), Cerebras (base URL: api.cerebras.ai), Mistral (base URL: api.mistral.ai), and OpenRouter (base URL: openrouter.ai/api) by configuring the base_url parameter.
3. THE Provider_Adapter SHALL implement a Gemini-native adapter that calls the Google Generative Language API using the x-goog-api-key header and the generateContent endpoint.
4. WHEN the Fallback_Wrapper selects a key, THE Provider_Adapter SHALL route the request to the correct adapter based on the provider field of the key record.
5. THE Provider_Adapter SHALL set a request timeout of 30 seconds for each individual API call.
6. THE Provider_Adapter SHALL pass temperature (0.7) and max_tokens (4096 for OpenAI-compatible, 8192 for Gemini) as default generation parameters.

### Requirement 5: Migration of Existing Keys

**User Story:** As an administrator, I want existing AI keys from the settings table automatically migrated to the new ai_providers table, so that no manual reconfiguration is needed after the upgrade.

#### Acceptance Criteria

1. WHEN the migration runs, THE AI_Provider_System SHALL read the values of gemini_api_key, ai_fallback_key, and ai_key_3 from the settings table.
2. WHEN a settings key has a non-empty value, THE AI_Provider_System SHALL insert it into the ai_providers table with the correct provider detected from the key prefix (gsk_ for groq, AIza for gemini).
3. THE AI_Provider_System SHALL assign priority values 1, 2, and 3 to the migrated keys corresponding to gemini_api_key, ai_fallback_key, and ai_key_3 respectively.
4. THE AI_Provider_System SHALL assign the label "Primary (migrated)", "Fallback 1 (migrated)", and "Fallback 2 (migrated)" to the three migrated keys respectively.
5. THE AI_Provider_System SHALL preserve the model value from the gemini_model and ai_fallback_model settings for the corresponding migrated keys.
6. IF a settings key value is empty or missing, THEN THE AI_Provider_System SHALL skip that key during migration without error.

### Requirement 6: Backward-Compatible Consumer Integration

**User Story:** As a developer, I want all existing AI consumers to use the new fallback wrapper without requiring changes to their calling interfaces, so that the migration is transparent.

#### Acceptance Criteria

1. THE Fallback_Wrapper SHALL export a function with the same signature as the existing generateWithGemini function (prompt: string, apiKey: string, model?: string, fallbackKey?: string, fallbackModel?: string, fallbackKey2?: string): Promise<string>.
2. WHEN the generateWithGemini function is called, THE Fallback_Wrapper SHALL ignore the passed key parameters and instead use keys from the ai_providers table.
3. THE AI_Provider_System SHALL maintain compatibility with the following consumers without requiring changes to their source code: entranceExamAI, tabAI, moduleAI, and the autofill module.
4. WHEN no enabled keys exist in the ai_providers table, THE Fallback_Wrapper SHALL fall back to using the key parameters passed directly to the function.

### Requirement 7: Health-Check Dashboard

**User Story:** As an administrator, I want a dashboard showing the health status of all configured AI keys, so that I can quickly identify failing or exhausted keys.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display a table listing every AI provider key with columns: provider, label, status (derived from last_error being null or not), last_used_at timestamp, last_error message, and usage_count.
2. THE Health_Dashboard SHALL display a green indicator for keys with no last_error and a red indicator for keys with a recorded last_error.
3. WHEN the administrator clicks a refresh button, THE Health_Dashboard SHALL reload the provider data from the ai_providers table.
4. THE Health_Dashboard SHALL display the total number of AI requests served (sum of all usage_count values) and the number of currently enabled keys.

### Requirement 8: Request Logging

**User Story:** As an administrator, I want each AI call logged with provider, key, status, and latency information, so that I can audit AI usage and diagnose failures.

#### Acceptance Criteria

1. WHEN the Fallback_Wrapper completes a request (success or failure), THE Request_Log SHALL record: id (UUID), provider_id (foreign key to ai_providers), prompt_hash (SHA-256 hash of the prompt text, not the full prompt), status (success or error), error_message (text, null on success), latency_ms (integer), consumer_name (string identifying the calling module), and created_at (timestamp).
2. THE Request_Log SHALL store records in an ai_request_logs table in the database.
3. THE Health_Dashboard SHALL display the 20 most recent request log entries with columns: timestamp, provider label, status, latency, and consumer name.
4. THE AI_Provider_System SHALL retain request log entries for 30 days and automatically delete entries older than 30 days.
5. IF logging fails, THEN THE Fallback_Wrapper SHALL continue returning the AI response to the caller without interruption.
