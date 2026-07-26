/**
 * exam.ts — CMS-side exam types.
 * Mirror of frontend types/exam.ts with CMS-specific extensions.
 * Field names match frontend exactly so service layer swap is seamless.
 */

export type Pillar = "sarkari-naukri" | "entrance-exam" | "board-university";

export type ContentType =
  | "notification"
  | "application"
  | "admit-card"
  | "date-sheet"
  | "syllabus"
  | "answer-key"
  | "result"
  | "cutoff"
  | "previous-papers"
  | "mock-test"
  | "study-material"
  | "books";

export type ExamStatus =
  | "upcoming"
  | "active"
  | "registration-open"
  | "registration-closed"
  | "result-declared"
  | "completed"
  | "ongoing";

/** Maps Supabase snake_case rows → camelCase ExamEntity (matches frontend type) */
export type ExamEntity = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  pillar: Pillar;
  category: string;       // category slug (from categories table)
  subcategory: string;    // subcategory slug
  entityType: "exam" | "board" | "university" | "recruitment";
  conductingBody: string;
  officialWebsite: string;
  status: ExamStatus;

  // Content flags — match frontend hasX names exactly
  hasAdmitCard: boolean;
  hasResult: boolean;
  hasAnswerKey: boolean;
  hasSyllabus: boolean;
  hasDateSheet: boolean;
  hasMockTest: boolean;
  hasPreviousPapers: boolean;
  hasStudyMaterial: boolean;
  hasApplication: boolean;
  hasNotification: boolean;
  hasCutoff: boolean;

  dates: { label: string; date: string; isUrgent: boolean }[];
  eligibility?: { age: string; qualification: string; nationality: string };
  vacancy?: number;
  applicationFee?: { general: number; obc: number; sc: number; st: number; ews?: number };
  selectionProcess?: string[];
  syllabusHighlights?: string[];
  academicYear?: string;
  semester?: string;
  admissionTo?: string;

  tags: string[];
  lastUpdated: string;
  isFeatured: boolean;
  searchKeywords: string[];

  seoTitle?: string;
  seoDescription?: string;
  faqs?: { question: string; answer: string }[];

  // Publish gate — must be true for the frontend to display it
  isPublished: boolean;

  // CMS-only meta
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

/** Content post — mirrors frontend ContentPost type with CMS workflow fields */
export type ContentPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  examEntityId: string;
  examEntityName: string;
  pillar: string;
  contentType: ContentType;

  quickLinks: { label: string; url: string; isPDF: boolean; isOfficial: boolean }[];
  importantDates?: { label: string; date: string; isUrgent: boolean }[];
  /** Structured per-content-type fields — schema varies by contentType */
  contentTypeData: Record<string, unknown>;
  /** Attachments: PDFs, images, external URLs */
  attachmentUrls: { label: string; url: string; type: "pdf" | "image" | "external"; isOfficial: boolean }[];

  featuredImage?: string;
  tags: string[];

  status: "draft" | "review" | "published" | "unpublished";
  isFeatured: boolean;
  views: number;

  seoTitle: string;
  seoDescription: string;
  faqs?: { question: string; answer: string }[];

  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};
