export type RoleSlug =
  | "super-admin"
  | "admin"
  | "editor"
  | "author"
  | "advertiser";

export type Role = {
  id: string;
  slug: RoleSlug;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type UserProfile = {
  id: string;
  name: string;
  avatar: string | null;
  roleId: string;
  roleName: string;
  roleSlug: RoleSlug;
  permissions: string[];
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
  profile: UserProfile;
};
