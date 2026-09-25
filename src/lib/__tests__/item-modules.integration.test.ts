import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import {
  checkOutAccessory,
  checkInAccessory,
  listAccessoryHolders
} from "@/lib/accessories";
import { issueConsumable, listConsumableIssues } from "@/lib/consumables";
import {
  assignComponentToAsset,
  unassignComponent,
  listComponentAssignments
} from "@/lib/components";

const hasDb = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();

// Exercises the real item-module action functions against the local Postgres.
// This covers the queries that combine row locking with usage counts, which a
// pure-SQL replay would miss.
describe.skipIf(!hasDb)("item module actions (integration)", () => {
  let userId = "";
  let assetId = "";

  beforeAll(async () => {
    userId = (
      await getPool().query<{ id: string }>("SELECT id FROM app_users WHERE active = true LIMIT 1")
    ).rows[0].id;
    assetId = (await getPool().query<{ id: string }>("SELECT id FROM assets LIMIT 1")).rows[0].id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("accessory checkout and check-in", async () => {
    const name = `Vitest Accessory ${stamp}`;
    const id = (
      await getPool().query<{ id: string }>(
        "INSERT INTO accessories (name, qty, min_amt) VALUES ($1, 5, 1) RETURNING id",
        [name]
      )
    ).rows[0].id;
    try {
      await checkOutAccessory(id, userId);
      const holders = await listAccessoryHolders(id);
      expect(holders.length).toBe(1);
      await checkInAccessory(holders[0].checkoutId);
      expect((await listAccessoryHolders(id)).length).toBe(0);
    } finally {
      await getPool().query("DELETE FROM accessories WHERE id = $1", [id]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [name]);
    }
  });

  it("consumable issue", async () => {
    const name = `Vitest Consumable ${stamp}`;
    const id = (
      await getPool().query<{ id: string }>(
        "INSERT INTO consumables (name, qty, min_amt) VALUES ($1, 5, 1) RETURNING id",
        [name]
      )
    ).rows[0].id;
    try {
      await issueConsumable(id, userId);
      expect((await listConsumableIssues(id)).length).toBe(1);
    } finally {
      await getPool().query("DELETE FROM consumables WHERE id = $1", [id]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [name]);
    }
  });

  it("component assign and unassign", async () => {
    const name = `Vitest Component ${stamp}`;
    const id = (
      await getPool().query<{ id: string }>(
        "INSERT INTO components (name, qty, min_amt) VALUES ($1, 10, 1) RETURNING id",
        [name]
      )
    ).rows[0].id;
    try {
      await assignComponentToAsset(id, assetId, 2);
      const assignments = await listComponentAssignments(id);
      expect(assignments.length).toBe(1);
      expect(assignments[0].qty).toBe(2);
      await unassignComponent(assignments[0].assignmentId);
      expect((await listComponentAssignments(id)).length).toBe(0);
    } finally {
      await getPool().query("DELETE FROM components WHERE id = $1", [id]);
      await getPool().query("DELETE FROM audit_log WHERE record_id = $1", [name]);
    }
  });
});
