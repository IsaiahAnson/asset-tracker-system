import { getPool } from "@/lib/db";

export type AssetHit = {
  id: string;
  assetTag: string;
  model: string;
  serial: string | null;
  custodian: string;
  status: string;
};
export type PersonHit = { id: string; displayName: string; email: string; group: string | null };
export type ShortcutHit = { label: string; description: string; href: string };

export type SearchResults = {
  shortcuts: ShortcutHit[];
  assets: AssetHit[];
  people: PersonHit[];
};

const LIMIT = 25;

// Admin/tool destinations surfaced as "Quick actions" in search, mirroring the
// ERPNext awesomebar (type "customize" and the Customize Form action appears).
// Each entry matches when the query overlaps any of its keywords in either
// direction (substring match), so "custom", "template", "form", "field" all
// surface the Custom Field builder.
const SHORTCUTS: (ShortcutHit & { keywords: string[] })[] = [
  {
    label: "Customize Form",
    description: "Add and manage custom fields on the asset form (admin)",
    href: "/settings/custom-fields",
    keywords: [
      "customize",
      "customize form",
      "custom",
      "custom field",
      "custom fields",
      "field",
      "fields",
      "form",
      "template",
      "create template",
      "create field",
      "new field",
      "add field"
    ]
  }
];

function matchShortcuts(query: string): ShortcutHit[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return SHORTCUTS.filter((s) =>
    s.keywords.some((k) => k.includes(q) || q.includes(k))
  ).map(({ label, description, href }) => ({ label, description, href }));
}

// Cross-entity quick search backing the global top-bar search box. Matches
// assets (tag/serial/custodian) and people (name/email). Results are capped
// per entity so the page stays responsive.
export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { shortcuts: [], assets: [], people: [] };
  const like = `%${q}%`;
  const shortcuts = matchShortcuts(q);

  const [assets, people] = await Promise.all([
    getPool().query<{
      id: string;
      asset_tag: string;
      model: string | null;
      manufacturer: string | null;
      serial_number: string | null;
      custodian: string | null;
      status: string;
    }>(
      `SELECT a.id, a.asset_tag, a.model, a.manufacturer, a.serial_number, a.status,
              u.display_name AS custodian
         FROM assets a
         LEFT JOIN app_users u ON u.id = a.current_custodian_id
        WHERE a.asset_tag ILIKE $1
           OR a.serial_number ILIKE $1
           OR u.display_name ILIKE $1
        ORDER BY a.asset_tag
        LIMIT ${LIMIT}`,
      [like]
    ),
    getPool().query<{ id: string; display_name: string; email: string; group_code: string | null }>(
      `SELECT u.id, u.display_name, u.email, g.code AS group_code
         FROM app_users u
         LEFT JOIN groups g ON g.id = u.group_id
        WHERE u.display_name ILIKE $1 OR u.email ILIKE $1
        ORDER BY u.display_name
        LIMIT ${LIMIT}`,
      [like]
    )
  ]);

  return {
    shortcuts,
    assets: assets.rows.map((r) => ({
      id: r.id,
      assetTag: r.asset_tag,
      model: [r.manufacturer, r.model].filter(Boolean).join(" ") || "Computer",
      serial: r.serial_number,
      custodian: r.custodian ?? "Unassigned",
      status: r.status
    })),
    people: people.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      group: r.group_code
    }))
  };
}
