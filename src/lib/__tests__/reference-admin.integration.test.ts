import { describe, it, expect, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import {
  createCategory,
  updateCategory,
  createRole,
  updateRole,
  createGroup
} from "@/lib/reference-admin";
import { getReferenceData } from "@/lib/reference";

const hasDb = Boolean(process.env.DATABASE_URL);

// Reference-data admin editing: create/update for categories, groups, roles,
// each writing an audit row. Auto-skipped when DATABASE_URL is unset.
describe.skipIf(!hasDb)("reference-data admin editing (integration)", () => {
  const catCodes: string[] = [];
  const roleCodes: string[] = [];
  const groupCodes: string[] = [];

  afterAll(async () => {
    const all = [...catCodes, ...roleCodes, ...groupCodes];
    for (const code of catCodes) await getPool().query("DELETE FROM asset_categories WHERE code = $1", [code]);
    for (const code of roleCodes) await getPool().query("DELETE FROM roles WHERE code = $1", [code]);
    for (const code of groupCodes) await getPool().query("DELETE FROM groups WHERE code = $1", [code]);
    if (all.length) {
      await getPool().query("DELETE FROM audit_log WHERE record_id = ANY($1)", [all]);
    }
    await getPool().end();
  });

  it("creates an asset category with an auto code and an audit row", async () => {
    await createCategory({ name: "Vitest Tablets", highSensitivity: false });
    const data = await getReferenceData();
    const cat = data.categories.find((c) => c.name === "Vitest Tablets");
    expect(cat).toBeDefined();
    expect(cat?.code).toBe("vitest_tablets");
    catCodes.push(cat!.code);

    const audit = await getPool().query<{ action: string }>(
      "SELECT action FROM audit_log WHERE record_type = 'asset_category' AND record_id = $1",
      [cat!.code]
    );
    expect(audit.rows.some((r) => r.action === "Created asset category")).toBe(true);
  });

  it("updates a category name and sensitivity, keeping the code fixed", async () => {
    const before = (await getReferenceData()).categories.find((c) => c.code === "vitest_tablets")!;
    await updateCategory(before.id, { name: "Vitest Tablets (mobile)", highSensitivity: true });
    const after = (await getReferenceData()).categories.find((c) => c.code === "vitest_tablets")!;
    expect(after.name).toBe("Vitest Tablets (mobile)");
    expect(after.highSensitivity).toBe(true);
    expect(after.code).toBe("vitest_tablets"); // code never changes
  });

  it("creates and updates a role with audit rows", async () => {
    await createRole({ name: "Vitest Auditor", description: "Read access for testing" });
    const role = (await getReferenceData()).roles.find((r) => r.name === "Vitest Auditor")!;
    expect(role.code).toBe("vitest_auditor");
    roleCodes.push(role.code);

    await updateRole(role.id, { name: "Vitest Auditor", description: "Updated description" });
    const updated = (await getReferenceData()).roles.find((r) => r.code === "vitest_auditor")!;
    expect(updated.description).toBe("Updated description");

    const audit = await getPool().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM audit_log WHERE record_type = 'role' AND record_id = 'vitest_auditor'"
    );
    expect(Number(audit.rows[0].n)).toBeGreaterThanOrEqual(2);
  });

  it("creates a group with the NWA- code convention", async () => {
    await createGroup({ name: "Vitest Denver Office" });
    const group = (await getReferenceData()).groups.find((g) => g.name === "Vitest Denver Office")!;
    expect(group.code.startsWith("NWA-")).toBe(true);
    groupCodes.push(group.code);
  });
});
