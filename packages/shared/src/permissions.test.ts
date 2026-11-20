import { describe, expect, it } from "vitest";
import { canEdit, canManage, hasRoleAtLeast, isRole, ROLE_RANK } from "./permissions";

describe("permissions", () => {
  it("orders roles from viewer to owner", () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeLessThan(ROLE_RANK.owner);
  });

  it("lets viewers read but not write", () => {
    expect(hasRoleAtLeast("viewer", "viewer")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canManage("viewer")).toBe(false);
  });

  it("lets editors change content but not manage the board", () => {
    expect(canEdit("editor")).toBe(true);
    expect(canManage("editor")).toBe(false);
  });

  it("lets owners do everything", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canManage("owner")).toBe(true);
  });

  it("denies unknown or missing roles", () => {
    expect(hasRoleAtLeast(null, "viewer")).toBe(false);
    expect(canEdit(undefined)).toBe(false);
    expect(isRole("admin")).toBe(false);
    expect(isRole("editor")).toBe(true);
  });
});
