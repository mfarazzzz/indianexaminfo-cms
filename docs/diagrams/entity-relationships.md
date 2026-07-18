# Entity Relationship Diagrams

## Core Content OS Schema

```mermaid
erDiagram
    PILLAR ||--o{ ENTITY : "classifies"
    LIFECYCLE_TEMPLATE ||--o{ LIFECYCLE_TEMPLATE_VERSION : "has versions"
    LIFECYCLE_TEMPLATE_VERSION ||--o{ ENTITY : "configures via snapshot"
    CONDUCTING_BODY ||--o{ ENTITY : "conducts"
    CATEGORY ||--o{ ENTITY : "categorizes"

    ENTITY ||--|| ENTITY_SNAPSHOT : "has frozen config"
    ENTITY ||--|| ENTITY_SEO : "has SEO"
    ENTITY ||--o| ENTITY_ELIGIBILITY : "has eligibility"
    ENTITY ||--o| ENTITY_FEE : "has fee structure"
    ENTITY ||--o{ ENTITY_MODULE : "has modules"
    ENTITY ||--o{ ENTITY_TIMELINE_EVENT : "has timeline"
    ENTITY ||--o{ ENTITY_VACANCY : "has vacancies"
    ENTITY ||--o{ ENTITY_EXAM_PATTERN : "has exam pattern"
    ENTITY ||--o{ ENTITY_SELECTION_STAGE : "has selection stages"
    ENTITY ||--o{ ENTITY_SYLLABUS_SUBJECT : "has syllabus"
    ENTITY ||--o{ ENTITY_DOWNLOAD : "has downloads"
    ENTITY ||--o{ ENTITY_LINK : "has links"
    ENTITY ||--o{ ENTITY_REVISION : "has revisions"
    ENTITY ||--o{ ENTITY_ACTIVITY_LOG : "has activity"

    ENTITY_MODULE ||--o{ MODULE_BLOCK : "contains blocks"

    ENTITY {
        uuid id PK
        text entity_type
        text slug
        text name
        text pillar FK
        uuid template_version_id FK
        text workflow_status
        jsonb metadata
    }

    ENTITY_MODULE {
        uuid id PK
        uuid entity_id FK
        text module_type
        int display_order
        text workflow_status
    }

    MODULE_BLOCK {
        uuid id PK
        uuid module_id FK
        text block_type
        int display_order
        jsonb content
    }

    ENTITY_TIMELINE_EVENT {
        uuid id PK
        uuid entity_id FK
        text stage_key
        text title
        date event_date
        text status
    }

    ENTITY_SNAPSHOT {
        uuid entity_id PK
        jsonb snapshot
    }
```

## Auth & Permissions Schema

```mermaid
erDiagram
    AUTH_USERS ||--|| USER_PROFILES : "extends"
    USER_PROFILES }o--|| ROLES : "has role"
    ROLES ||--o{ ROLE_PERMISSIONS : "has"
    ROLE_PERMISSIONS }o--|| PERMISSIONS : "grants"

    USER_PROFILES {
        uuid id PK_FK
        text name
        text avatar
        uuid role_id FK
        boolean is_active
    }

    ROLES {
        uuid id PK
        text slug
        text name
        boolean is_system
    }

    PERMISSIONS {
        uuid id PK
        text slug
        text label
        text group
    }

    ROLE_PERMISSIONS {
        uuid role_id FK
        uuid permission_id FK
    }
```

## CMS Results & News Schema

```mermaid
erDiagram
    CMS_RESULTS {
        uuid id PK
        text slug
        text title
        text title_hindi
        date result_date
        text organization
        text category
        text status
        boolean is_featured
    }

    CMS_EDUCATION_NEWS {
        uuid id PK
        text slug
        text title
        text title_hindi
        text category
        text status
        boolean is_breaking
        boolean is_featured
    }

    MEDIA {
        uuid id PK
        text filename
        text url
        text mime_type
        int size
        text folder
    }
```

## Advertising Schema

```mermaid
erDiagram
    ADVERTISERS ||--o{ AD_CAMPAIGNS : "creates"
    AD_CAMPAIGNS ||--o{ AD_CREATIVES : "contains"
    AD_CAMPAIGNS ||--o{ AD_REPORTS : "generates"
    AD_ZONES ||--o{ AD_REPORTS : "tracks"

    ADVERTISERS {
        uuid id PK
        text name
        text company_name
        text status
    }

    AD_CAMPAIGNS {
        uuid id PK
        uuid advertiser_id FK
        text name
        text status
        numeric budget_total
    }

    AD_CREATIVES {
        uuid id PK
        uuid campaign_id FK
        text type
        text link_url
    }

    AD_ZONES {
        uuid id PK
        text slug
        text position
        text page_placement
    }
```
