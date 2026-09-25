"use server";

import { revalidatePath } from "next/cache";
import {
  createFieldDefinition,
  updateFieldDefinition,
  setFieldActive,
  deleteFieldDefinition,
  moveFieldDefinition,
  type FieldType
} from "@/lib/custom-fields";
import { setFlash } from "@/lib/flash";
import { guardAdmin } from "@/lib/authz";

const VALID_TYPES = new Set<FieldType>(["text", "textarea", "number", "date", "select", "checkbox"]);
const SETTINGS_PATH = "/settings/custom-fields";

// Options come from a textarea, one per line. Trim, drop blanks, de-dupe.
function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const v = line.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function revalidateAll() {
  revalidatePath(SETTINGS_PATH);
  // Field set changes affect where the fields render.
  revalidatePath("/assets");
}

export async function createCustomFieldAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) {
    revalidatePath(SETTINGS_PATH);
    return;
  }
  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("fieldType") ?? "").trim() as FieldType;
  const helpText = String(formData.get("helpText") ?? "").trim() || null;
  const defaultValue = String(formData.get("defaultValue") ?? "").trim() || null;
  const required = formData.get("required") === "on" || formData.get("required") === "true";
  const section = String(formData.get("section") ?? "").trim() || null;
  const options = fieldType === "select" ? parseOptions(String(formData.get("options") ?? "")) : [];

  if (!label) {
    await setFlash("error", "Field label is required.");
    revalidatePath(SETTINGS_PATH);
    return;
  }
  if (!VALID_TYPES.has(fieldType)) {
    await setFlash("error", "Choose a valid field type.");
    revalidatePath(SETTINGS_PATH);
    return;
  }
  if (fieldType === "select" && options.length === 0) {
    await setFlash("error", "Select fields need at least one option (one per line).");
    revalidatePath(SETTINGS_PATH);
    return;
  }

  try {
    await createFieldDefinition({ label, fieldType, options, helpText, defaultValue, required, section });
    await setFlash("success", `Added custom field "${label}".`);
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not add field.");
  }
  revalidateAll();
}

export async function updateCustomFieldAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) {
    revalidatePath(SETTINGS_PATH);
    return;
  }
  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("fieldType") ?? "").trim() as FieldType;
  const helpText = String(formData.get("helpText") ?? "").trim() || null;
  const defaultValue = String(formData.get("defaultValue") ?? "").trim() || null;
  const required = formData.get("required") === "on" || formData.get("required") === "true";
  const section = String(formData.get("section") ?? "").trim() || null;
  const options = fieldType === "select" ? parseOptions(String(formData.get("options") ?? "")) : [];

  if (!id || !label || !VALID_TYPES.has(fieldType)) {
    await setFlash("error", "Field label and type are required.");
    revalidatePath(SETTINGS_PATH);
    return;
  }
  if (fieldType === "select" && options.length === 0) {
    await setFlash("error", "Select fields need at least one option (one per line).");
    revalidatePath(SETTINGS_PATH);
    return;
  }

  try {
    await updateFieldDefinition(id, { label, fieldType, options, helpText, defaultValue, required, section });
    await setFlash("success", `Updated "${label}".`);
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not update field.");
  }
  revalidateAll();
}

export async function toggleCustomFieldAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) {
    revalidatePath(SETTINGS_PATH);
    return;
  }
  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  try {
    await setFieldActive(id, active);
    await setFlash("success", active ? "Field activated." : "Field deactivated.");
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not change field state.");
  }
  revalidateAll();
}

export async function deleteCustomFieldAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) {
    revalidatePath(SETTINGS_PATH);
    return;
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  try {
    await deleteFieldDefinition(id);
    await setFlash("success", "Custom field deleted.");
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not delete field.");
  }
  revalidateAll();
}

export async function moveCustomFieldAction(formData: FormData): Promise<void> {
  if (!(await guardAdmin())) {
    revalidatePath(SETTINGS_PATH);
    return;
  }
  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id || (direction !== "up" && direction !== "down")) return;
  try {
    await moveFieldDefinition(id, direction);
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not reorder field.");
  }
  revalidateAll();
}
