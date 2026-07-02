export type Menu = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
  items?: MenuItem[];
};

export type MenuItem = {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  url: string | null;
  opensInNewTab: boolean;
  icon: string | null;
  badge: string | null;
  badgeColor: string | null;
  orderIndex: number;
  isActive: boolean;
  examId: string | null;
  categoryId: string | null;
  createdAt: string;
  children?: MenuItem[];
};
