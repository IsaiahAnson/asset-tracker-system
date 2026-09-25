import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getPool().query<{
      database_name: string;
      checked_at: string;
    }>("SELECT current_database() AS database_name, now()::text AS checked_at");

    return Response.json({
      status: "ok",
      database: result.rows[0].database_name,
      checkedAt: result.rows[0].checked_at
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return Response.json(
      {
        status: "error",
        message
      },
      { status: 503 }
    );
  }
}
