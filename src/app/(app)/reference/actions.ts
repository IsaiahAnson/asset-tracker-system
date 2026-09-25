"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  updateCategory,
  createGroup,
  updateGroup,
  createRole,
  updateRole
} from "@/lib/reference-admin";
import { setFlash } from "@/lib/flash";
import { guardAdmin } from "@/lib/authz";

const PATH = "/reference";

function isOn(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true";
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) { await setFlash("error", "Category name is required."); revalidatePath(PATH); return; }
  try {
    await createCategory({ name, highSensitivity: isOn(formData.get("highSensitivity")) });
    await setFlash("success", `Added asset category "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not add category.");
  }
  revalidatePath(PATH);
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) { await setFlash("error", "Category name is required."); revalidatePath(PATH); return; }
  try {
    await updateCategory(id, { name, highSensitivity: isOn(formData.get("highSensitivity")) });
    await setFlash("success", `Updated "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not update category.");
  }
  revalidatePath(PATH);
}

export async function createGroupAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) { await setFlash("error", "Group name is required."); revalidatePath(PATH); return; }
  try {
    await createGroup({ name });
    await setFlash("success", `Added group "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not add group.");
  }
  revalidatePath(PATH);
}

export async function updateGroupAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) { await setFlash("error", "Group name is required."); revalidatePath(PATH); return; }
  try {
    await updateGroup(id, { name });
    await setFlash("success", `Updated "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not update group.");
  }
  revalidatePath(PATH);
}

export async function createRoleAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) { await setFlash("error", "Role name is required."); revalidatePath(PATH); return; }
  try {
    await createRole({ name, description });
    await setFlash("success", `Added role "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not add role.");
  }
  revalidatePath(PATH);
}

export async function updateRoleAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) { revalidatePath(PATH); return; }
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!id || !name) { await setFlash("error", "Role name is required."); revalidatePath(PATH); return; }
  try {
    await updateRole(id, { name, description });
    await setFlash("success", `Updated "${name}".`);
  } catch (e) {
    await setFlash("error", e instanceof Error ? e.message : "Could not update role.");
  }
  revalidatePath(PATH);
}
