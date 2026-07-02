import { NextResponse } from 'next/server';
import { query } from '@/db/postgres';

// GET: daily time series for the dashboard's line charts.
// - changelogChanges: bullets (incident_links) grouped by the day their
//   changelog (version) was closed.
// - issues: ClickUp issues (incident_links) grouped by day, split into
//   radicados (created that day) vs solucionados (closed that day).
export async function GET() {
  try {
    const [changelogResult, radicadosResult, solucionadosResult] =
      await Promise.all([
        query<{ day: string; count: string }>(
          `SELECT TO_CHAR(v.closed_at, 'YYYY-MM-DD') AS day,
                  COUNT(il.id) AS count
           FROM versions v
           LEFT JOIN incident_links il ON il.version_id = v.id
           WHERE v.closed_at IS NOT NULL
           GROUP BY TO_CHAR(v.closed_at, 'YYYY-MM-DD')
           ORDER BY day ASC`
        ),
        query<{ day: string; count: string }>(
          `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
           FROM incident_links
           GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
           ORDER BY day ASC`
        ),
        query<{ day: string; count: string }>(
          `SELECT TO_CHAR(closed_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
           FROM incident_links
           WHERE closed_at IS NOT NULL
           GROUP BY TO_CHAR(closed_at, 'YYYY-MM-DD')
           ORDER BY day ASC`
        ),
      ]);

    const changelogChanges = changelogResult.rows.map((row) => ({
      date: row.day,
      count: parseInt(row.count, 10),
    }));

    const radicadosByDay = new Map(
      radicadosResult.rows.map((row) => [row.day, parseInt(row.count, 10)])
    );
    const solucionadosByDay = new Map(
      solucionadosResult.rows.map((row) => [row.day, parseInt(row.count, 10)])
    );
    const allDays = Array.from(
      new Set([...radicadosByDay.keys(), ...solucionadosByDay.keys()])
    ).sort();

    const issues = allDays.map((day) => ({
      date: day,
      radicados: radicadosByDay.get(day) || 0,
      solucionados: solucionadosByDay.get(day) || 0,
    }));

    return NextResponse.json({ changelogChanges, issues });
  } catch (error) {
    console.error('Error fetching operational timeseries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operational timeseries' },
      { status: 500 }
    );
  }
}
