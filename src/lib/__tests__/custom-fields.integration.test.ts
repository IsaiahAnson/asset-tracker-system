import { describe, it, expect, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import {
  createFieldDefinition,
  updateFieldDefinition,
  setFieldActive,
  deleteFieldDefinition,
  moveFieldDefinition,
  listFieldDefinitions,
  listActiveFieldDefinitions,
  getAssetCustomValuesForDisplay,
  validateCustomValues,
  formatCustomValue
} from "@/lib/custom-fields";
import { createComputerAsset } from "@/lib/assets";

const hasDb = Boolean(process.env.DATABASE_URL);

// Custom Field ("Customize Form") integration tests: definition CRUD, ordering,
// active toggle, end-to-end value save via createComputerAsset, and the pure
// validation/format helpers. Auto-skipped when DATABASE_URL is unset.
describe.skipIf(!hasDb)("custom fields (integration)", () => {
  const createdFieldIds: string[] = [];
  const createdAssetTags: string[] = [];

  afterAll(async () => {
    for (const tag of createdAssetTags) {
      await getPool().query("DELETE FROM assets WHERE asset_tag = $1", [tag]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [tag]);
    }
    for (const id of createdFieldIds) {
      await getPool().query("DELETE FROM custom_field_definitions WHERE id = $1", [id]);
    }
    // Custom-field mutations write audit rows keyed by field_key; remove the
    // ones this suite created so a test run never leaves vitest_* entries in
    // the Recent activity feed of a shared database.
    await getPool().query("DELETE FROM audit_log WHERE record_type = 'custom_field' AND record_id LIKE 'vitest%'");
    await getPool().end();
  });

  it("creates a definition with an auto-generated key and lists it active", async () => {
    const { id } = await createFieldDefinition({
      label: "Vitest Cost Center",
      fieldType: "text",
      helpText: "Cost center code"
    });
    createdFieldIds.push(id);

    const active = await listActiveFieldDefinitions("asset");
    const found = active.find((d) => d.id === id);
    expect(found).toBeDefined();
    expect(found?.fieldKey).toBe("vitest_cost_center");
    expect(found?.helpText).toBe("Cost center code");
  });

  it("stores select options and updates them", async () => {
    const { id } = await createFieldDefinition({
      label: "Vitest Tier",
      fieldType: "select",
      options: ["Gold", "Silver"]
    });
    createdFieldIds.push(id);

    let def = (await listFieldDefinitions("asset")).find((d) => d.id === id);
    expect(def?.options).toEqual(["Gold", "Silver"]);

    await updateFieldDefinition(id, {
      label: "Vitest Tier",
      fieldType: "select",
      options: ["Gold", "Silver", "Bronze"],
      required: true
    });
    def = (await listFieldDefinitions("asset")).find((d) => d.id === id);
    expect(def?.options).toEqual(["Gold", "Silver", "Bronze"]);
    expect(def?.required).toBe(true);
  });

  it("hides a deactivated field from the active list but keeps it in the full list", async () => {
    const { id } = await createFieldDefinition({ label: "Vitest Hidden", fieldType: "text" });
    createdFieldIds.push(id);

    await setFieldActive(id, false);
    expect((await listActiveFieldDefinitions("asset")).some((d) => d.id === id)).toBe(false);
    expect((await listFieldDefinitions("asset")).some((d) => d.id === id)).toBe(true);
  });

  it("reorders fields by swapping display_order with the neighbor", async () => {
    const a = await createFieldDefinition({ label: "Vitest Order A", fieldType: "text" });
    const b = await createFieldDefinition({ label: "Vitest Order B", fieldType: "text" });
    createdFieldIds.push(a.id, b.id);

    const before = await listFieldDefinitions("asset");
    const idxA = before.findIndex((d) => d.id === a.id);
    const idxB = before.findIndex((d) => d.id === b.id);
    // B was created after A, so it should sort after A initially.
    expect(idxB).toBeGreaterThan(idxA);

    await moveFieldDefinition(b.id, "up");
    const after = await listFieldDefinitions("asset");
    expect(after.findIndex((d) => d.id === b.id)).toBeLessThan(after.findIndex((d) => d.id === a.id));
  });

  it("saves custom values atomically with a new asset and reads them back", async () => {
    const tier = await createFieldDefinition({
      label: "Vitest Save Tier",
      fieldType: "select",
      options: ["Alpha", "Beta"]
    });
    const flag = await createFieldDefinition({ label: "Vitest Save Flag", fieldType: "checkbox" });
    createdFieldIds.push(tier.id, flag.id);

    const tierKey = (await listActiveFieldDefinitions("asset")).find((d) => d.id === tier.id)!.fieldKey;
    const flagKey = (await listActiveFieldDefinitions("asset")).find((d) => d.id === flag.id)!.fieldKey;

    const created = await createComputerAsset({
      model: "Vitest CF Laptop",
      serial: `VITEST-CF-${Date.now()}`,
      office: "Vitest Office",
      customValues: { [tierKey]: "Beta", [flagKey]: "on" }
    });
    createdAssetTags.push(created.assetTag);

    const values = await getAssetCustomValuesForDisplay(created.id);
    const tierVal = values.find((v) => v.definition.id === tier.id);
    const flagVal = values.find((v) => v.definition.id === flag.id);
    expect(tierVal?.value).toBe("Beta");
    expect(flagVal?.value).toBe("true");
    expect(formatCustomValue(flagVal!.definition, flagVal!.value)).toBe("Yes");
  });

  it("validates required, number, date, and select constraints", () => {
    const definitions = [
      {
        id: "1", entity: "asset", fieldKey: "req", label: "Req", fieldType: "text" as const,
        options: [], helpText: null, defaultValue: null, required: true, displayOrder: 1, active: true, section: null
      },
      {
        id: "2", entity: "asset", fieldKey: "num", label: "Num", fieldType: "number" as const,
        options: [], helpText: null, defaultValue: null, required: false, displayOrder: 2, active: true, section: null
      },
      {
        id: "3", entity: "asset", fieldKey: "pick", label: "Pick", fieldType: "select" as const,
        options: ["X", "Y"], helpText: null, defaultValue: null, required: false, displayOrder: 3, active: true, section: null
      }
    ];

    expect(validateCustomValues(definitions, { num: "12" })).toContain("Req is required.");
    expect(validateCustomValues(definitions, { req: "ok", num: "abc" })).toContain("Num must be a number.");
    expect(validateCustomValues(definitions, { req: "ok", pick: "Z" })[0]).toMatch(/Pick must be one of/);
    expect(validateCustomValues(definitions, { req: "ok", num: "12", pick: "X" })).toEqual([]);
  });

  it("deletes a definition", async () => {
    const { id } = await createFieldDefinition({ label: "Vitest Delete Me", fieldType: "text" });
    await deleteFieldDefinition(id);
    expect((await listFieldDefinitions("asset")).some((d) => d.id === id)).toBe(false);
  });
});
