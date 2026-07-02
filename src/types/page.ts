export type Page = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isSystem: boolean;
  status: "draft" | "published";
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};
