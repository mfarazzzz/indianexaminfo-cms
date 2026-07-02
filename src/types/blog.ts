/**
 * blog.ts — CMS blog types.
 * Mirrors frontend types/blog.ts exactly.
 * BlogPost.author is an embedded BlogAuthor object (not just an ID).
 */

export type BlogSection =
  | "education-news"
  | "exam-prep"
  | "career-guidance"
  | "scholarship"
  | "study-abroad"
  | "edtech"
  | "student-life"
  | "opinion";

export type PostType =
  | "news"
  | "article"
  | "guide"
  | "listicle"
  | "opinion"
  | "interview"
  | "analysis"
  | "how-to";

export type BlogAuthor = {
  id: string;
  slug: string;
  name: string;
  designation: string;
  avatar: string;
  bio: string;
  totalPosts: number;
  specialization: string[];
  socialLinks: { twitter?: string; linkedin?: string };
  isActive: boolean;
  createdAt: string;
};

/** Mirrors frontend BlogPost exactly — author is embedded object */
export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  section: BlogSection;
  postType: PostType;
  author: BlogAuthor;         // embedded — joins blog_authors on read
  featuredImage: string;
  featuredImageCaption: string;
  readingTime: number;
  wordCount: number;
  views: number;
  shares: number;
  tags: string[];
  relatedExamSlugs: string[];  // matches frontend field name

  // CMS workflow
  status: "draft" | "review" | "published" | "unpublished";
  isFeatured: boolean;
  isBreaking: boolean;
  isPinned: boolean;

  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  tableOfContents: { id: string; title: string; level: 2 | 3 }[];
  faqs?: { question: string; answer: string }[];

  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};
