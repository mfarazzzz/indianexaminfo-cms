# Design Document: Entrance Exam Content Modules & AI Optimisation

## Overview

Enhances the Entrance Exam Editor with rich structured content modules, an exam news system, step-by-step guides, improved FAQs, media support, and smarter AI population — all stored as JSONB on existing tables (no breaking schema changes).

## Data Strategy: JSONB Modules on `exam_editions`

Instead of creating new tables for each content type, we store structured content as JSONB columns on `exam_editions`. This:
- Avoids breaking schema changes
- Keeps data co-located with the edition it belongs to
- Is backward compatible (new columns have defaults)
- Is queryable via Postgres JSONB operators when needed

### New JSONB Columns on `exam_editions`

```sql
ALTER TABLE exam_editions ADD COLUMN IF NOT EXISTS content_modules jsonb NOT NULL DEFAULT '{}'::jsonb;
```

The `content_modules` JSONB stores ALL structured content for this edition:

```typescript
interface EditionContentModules {
  // Step-by-step guides
  howToApply?: StepGuide;
  howToDownloadAdmitCard?: StepGuide;
  howToCheckResult?: StepGuide;
  howToDownloadAnswerKey?: StepGuide;
  howToDownloadNotification?: StepGuide;
  howToFillApplication?: StepGuide;
  howToPayFee?: StepGuide;
  howToCorrectApplication?: StepGuide;
  howToRecoverLogin?: StepGuide;

  // Exam details
  examPattern?: ExamPattern;
  selectionProcess?: string[];
  syllabus?: SyllabusSection[];
  eligibility?: EligibilityDetails;
  applicationFee?: FeeStructure;
  importantLinks?: ImportantLink[];
  highlights?: string[];

  // News (per-edition, linked)
  news?: ExamNewsItem[];
}

interface StepGuide {
  title: string;
  steps: { order: number; text: string; icon?: string; imageUrl?: string; link?: string }[];
}

interface ExamPattern {
  mode: string;          // "Online CBT" | "Offline" | "Hybrid"
  duration: string;      // "3 hours"
  totalMarks: number;
  sections: { name: string; questions: number; marks: number }[];
  markingScheme: string; // "+4/-1" etc.
}

interface SyllabusSection {
  subject: string;
  topics: string[];
}

interface EligibilityDetails {
  qualification: string;
  ageLimit: string;
  attempts: string;
  nationality: string;
  relaxation?: string;
}

interface FeeStructure {
  general: number;
  obc: number;
  sc: number;
  st: number;
  ews?: number;
  pwd?: number;
  female?: number;
  paymentModes: string[];
}

interface ImportantLink {
  label: string;
  url: string;
  isOfficial: boolean;
  type: "apply" | "notification" | "admit-card" | "result" | "syllabus" | "other";
}

interface ExamNewsItem {
  id: string;
  title: string;
  content: string;        // Rich text HTML
  excerpt: string;
  featuredImage?: string;
  images?: string[];
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  isPublished: boolean;
  isFeatured: boolean;
}
```

## Implementation Approach

Since this is a large feature set, implementation will be phased. The key constraint is: **no breaking changes, reuse existing models, backward compatible**.
