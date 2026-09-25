import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import {
  listFirearms,
  listBodyArmor,
  getFirearmDetail,
  listFirearmVerifications,
  evaluateClearance,
  getFirearmApprovalWorkflow,
  listEntities,
  listFirearmsAuthorizedPeople,
  surrenderToEntity,
  recordVerification
} from "@/lib/firearms";

const hasDb = Boolean(process.env.DATABASE_URL);

// Firearms-module integration tests: body armor, warehouse-entity assignees,
// mandatory verification checks, multi-stage approvals, and the surrender
// server action. Auto-skipped when DATABASE_URL is unset.
describe.skipIf(!hasDb)("firearms module (integration)", () => {
  const TEST_TAG = `VITEST-FRM-${Date.now()}`;
  let testAssetId = "";
  let entityId = "";
  let personId = "";

  beforeAll(async () => {
    // Pick a real entity destination + a person custodian to round-trip
    // a temporary firearm through the surrender flow.
    const e = await getPool().query<{ id: string }>(
      "SELECT id FROM app_users WHERE is_entity = true ORDER BY display_name LIMIT 1"
    );
    entityId = e.rows[0]?.id ?? "";

    const p = await getPool().query<{ id: string }>(
      "SELECT id FROM app_users WHERE is_entity = false AND firearm_access = true LIMIT 1"
    );
    personId = p.rows[0]?.id ?? "";
  });

  afterAll(async () => {
    if (testAssetId) {
      await getPool().query("DELETE FROM assets WHERE id = $1", [testAssetId]);
    }
    await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [TEST_TAG]);
    await getPool().end();
  });

  it("lists seeded firearms with verification summaries", async () => {
    const rows = await listFirearms();
    expect(rows.length).toBeGreaterThan(0);
    const row = rows.find((r) => r.assetTag === "NWA-FRM-00471");
    expect(row).toBeDefined();
    expect(row?.verifications.total).toBeGreaterThanOrEqual(3);
    expect(row?.verifications.passed).toBeGreaterThanOrEqual(3);
  });

  it("lists seeded body armor as its own category", async () => {
    const rows = await listBodyArmor();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.assetTag.startsWith("NWA-ARM-"))).toBe(true);
  });

  it("returns detail for a firearm with category, custodian, and entity flags", async () => {
    const list = await listFirearms();
    const target = list.find((r) => r.assetTag === "NWA-FRM-00471");
    expect(target).toBeDefined();
    const detail = await getFirearmDetail(target!.id);
    expect(detail).not.toBeNull();
    expect(detail?.category).toBe("firearms");
    expect(detail?.assetTag).toBe("NWA-FRM-00471");
    expect(detail?.custodianIsEntity).toBe(false);
  });

  it("flags NWA-FRM-00471 as cleared for issuance and NWA-FRM-00472 as blocked", async () => {
    const list = await listFirearms();
    const cleared = list.find((r) => r.assetTag === "NWA-FRM-00471");
    const blocked = list.find((r) => r.assetTag === "NWA-FRM-00472");
    expect(cleared).toBeDefined();
    expect(blocked).toBeDefined();

    const clearedChecks = await listFirearmVerifications(cleared!.id);
    const blockedChecks = await listFirearmVerifications(blocked!.id);

    expect(evaluateClearance(clearedChecks).cleared).toBe(true);
    const blockedState = evaluateClearance(blockedChecks);
    expect(blockedState.cleared).toBe(false);
    expect(blockedState.failing.length + blockedState.missing.length).toBeGreaterThan(0);
  });

  it("returns the multi-stage approval workflow with 4 stages and one pending at stage 3", async () => {
    const wf = await getFirearmApprovalWorkflow("NWA-FRM-00472");
    expect(wf).not.toBeNull();
    expect(wf!.workflowNumber).toBe("WF-2026-0431");
    expect(wf!.stages.length).toBe(4);
    expect(wf!.stages[0].status).toBe("approved");
    expect(wf!.stages[1].status).toBe("approved");
    expect(wf!.stages[2].status).toBe("pending");
    expect(wf!.stages[2].stageName).toBe("Internal Affairs");
  });

  it("lists warehouse entities and authorized people separately", async () => {
    const entities = await listEntities();
    const people = await listFirearmsAuthorizedPeople();
    expect(entities.length).toBeGreaterThanOrEqual(2);
    expect(entities.some((e) => e.displayName.includes("Warehouse"))).toBe(true);
    expect(people.length).toBeGreaterThan(0);
    // No overlap: an entity must never appear in the authorized-people list.
    const entityIds = new Set(entities.map((e) => e.id));
    expect(people.every((p) => !entityIds.has(p.id))).toBe(true);
  });

  it("surrenders a firearm from a person to an entity and records a custody event + audit row", async () => {
    expect(entityId).not.toBe("");
    expect(personId).not.toBe("");

    // Create a temporary firearm assigned to a real person.
    const created = await getPool().query<{ id: string }>(
      `INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, high_sensitivity)
       SELECT $1, c.id, g.id, $2, 'Vitest', 'Test Pistol', 'assigned', $3, 'Vitest Office', true
         FROM asset_categories c, groups g
        WHERE c.code = 'firearms' AND g.code = 'NWA'
       RETURNING id`,
      [TEST_TAG, `SER-${TEST_TAG}`, personId]
    );
    testAssetId = created.rows[0].id;

    await surrenderToEntity(TEST_TAG, entityId, "Vitest surrender");

    const after = await getPool().query<{ current_custodian_id: string; status: string }>(
      "SELECT current_custodian_id, status FROM assets WHERE id = $1",
      [testAssetId]
    );
    expect(after.rows[0].current_custodian_id).toBe(entityId);
    expect(after.rows[0].status).toBe("assigned");

    const events = await getPool().query<{ event_type: string; to_user_id: string }>(
      "SELECT event_type, to_user_id FROM custody_events WHERE asset_id = $1",
      [testAssetId]
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
    expect(events.rows[0].event_type).toBe("transfer");
    expect(events.rows[0].to_user_id).toBe(entityId);

    const audit = await getPool().query<{ action: string; metadata: { isSurrender?: boolean } }>(
      "SELECT action, metadata FROM audit_log WHERE record_id = $1",
      [TEST_TAG]
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    expect(audit.rows[0].metadata.isSurrender).toBe(true);
  });

  it("rejects surrender to a non-entity destination", async () => {
    expect(personId).not.toBe("");
    await expect(surrenderToEntity(TEST_TAG, personId)).rejects.toThrow(/entity/i);
  });

  it("upserts a verification record and updates the existing row on conflict", async () => {
    expect(testAssetId).not.toBe("");

    await recordVerification({
      assetTag: TEST_TAG,
      checkType: "ncic_background",
      status: "passed",
      notes: "Vitest first run"
    });
    await recordVerification({
      assetTag: TEST_TAG,
      checkType: "ncic_background",
      status: "expired",
      notes: "Vitest renewal"
    });

    const v = await getPool().query<{ status: string; notes: string }>(
      `SELECT status, notes FROM sensitive_asset_verifications
        WHERE asset_id = $1 AND check_type = 'ncic_background'`,
      [testAssetId]
    );
    expect(v.rows.length).toBe(1);
    expect(v.rows[0].status).toBe("expired");
    expect(v.rows[0].notes).toBe("Vitest renewal");
  });
});
