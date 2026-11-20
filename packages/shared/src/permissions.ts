export type Role = "owner" | "editor" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Владелец",
  editor: "Редактор",
  viewer: "Наблюдатель",
};

export function isRole(value: unknown): value is Role {
  return value === "owner" || value === "editor" || value === "viewer";
}

/** True when `role` grants at least the rights of `min`. */
export function hasRoleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function canEdit(role: Role | null | undefined): boolean {
  return hasRoleAtLeast(role, "editor");
}

export function canManage(role: Role | null | undefined): boolean {
  return hasRoleAtLeast(role, "owner");
}
