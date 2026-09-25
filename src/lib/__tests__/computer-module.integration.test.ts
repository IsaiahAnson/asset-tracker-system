import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import {
  createComputerAsset,
  listComputerAssets,
  transferCustody,
  checkInAsset,
  dispositionAsset
} from "@/lib/assets";

const hasDb = Boolean(process.env.DATABASE_URL);

// Runs the computer module end-to-end against the local Postgres. Auto-skips
// when DATABASE_URL is unset (e.g., CI without a database).
describe.skipIf(!hasDb)("computer module custody flow (integration)", () => {
  let assetTag = "";
  let userId = "";

  beforeAll(async () => {
    const u = await getPool().query<{ id: string }>(
      "SELECT id FROM app_users WHERE active = true LIMIT 1"
    );
    userId = u.rows[0].id;
  });

  afterAll(async () => {
    if (assetTag) {
      await getPool().query("DELETE FROM assets WHERE asset_tag = $1", [assetTag]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [assetTag]);
    }
    await getPool().end();
  });

  it("creates, transfers, checks in, and disposes with an audit trail", async () => {
    const created = await createComputerAsset({
      model: "Vitest Laptop",
      serial: "VITEST-" + Date.now(),
      office: "Vitest Office"
    });
    assetTag = created.assetTag;

    // created -> available
    let row = (await listComputerAssets({ q: assetTag })).find((r) => r.assetTag === assetTag);
    expect(row).toBeDefined();
    expect(row?.status).toBe("available");

    // transfer/issue -> assigned to a custodian
    await transferCustody(assetTag, userId);
    row = (await listComputerAssets({ q: assetTag })).find((r) => r.assetTag === assetTag);
    expect(row?.status).toBe("assigned");
    expect(row?.custodian).not.toBe("Unassigned");

    // check in -> available again
    await checkInAsset(assetTag);
    row = (await listComputerAssets({ q: assetTag })).find((r) => r.assetTag === assetTag);
    expect(row?.status).toBe("available");

    // dispose -> filtered out of the active list
    await dispositionAsset(assetTag);
    expect((await listComputerAssets({ q: assetTag })).find((r) => r.assetTag === assetTag)).toBeUndefined();

    // every mutation wrote an audit entry (create, issue, check-in, dispose)
    const audit = await getPool().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM audit_log WHERE record_id = $1",
      [assetTag]
    );
    expect(Number(audit.rows[0].n)).toBeGreaterThanOrEqual(4);
  });

  it("filters by status and search query", async () => {
    const tag = (
      await createComputerAsset({
        model: "Vitest Filter",
        serial: "VITEST-FILTER-" + Date.now(),
        office: "Filter Office"
      })
    ).assetTag;
    try {
      const byQuery = await listComputerAssets({ q: tag });
      expect(byQuery.some((r) => r.assetTag === tag)).toBe(true);

      const available = await listComputerAssets({ q: tag, status: "available" });
      expect(available.some((r) => r.assetTag === tag)).toBe(true);

      const assigned = await listComputerAssets({ q: tag, status: "assigned" });
      expect(assigned.some((r) => r.assetTag === tag)).toBe(false);
    } finally {
      await getPool().query("DELETE FROM assets WHERE asset_tag = $1", [tag]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [tag]);
    }
  });
});
