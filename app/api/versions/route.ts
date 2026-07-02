import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/db/postgres';
import { Version } from '@/lib/types';

// GET: list all versions (most recent first)
export async function GET() {
  try {
    const result = await query<Version>(
      'SELECT * FROM versions ORDER BY created_at DESC'
    );

    return NextResponse.json({
      versions: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('Error listing versions:', error);
    return NextResponse.json(
      { error: 'Failed to list versions' },
      { status: 500 }
    );
  }
}

// POST: open a new version draft. Only one version draft may be open at a
// time — the request is rejected if one already exists. Optionally accepts
// an initial set of bullets (document_type + description + clickup issue),
// each stamped with the creating user.
export async function POST(request: NextRequest) {
  let version: string | undefined;

  try {
    const body = await request.json();
    const { bullets, created_by } = body;
    version = body.version;

    if (!version) {
      return NextResponse.json(
        { error: 'Missing version' },
        { status: 400 }
      );
    }

    // Format: v1.0.0, v1.0.1, etc
    if (!version.match(/^v\d+\.\d+\.\d+$/)) {
      return NextResponse.json(
        { error: 'Version must be format vX.Y.Z (e.g., v1.0.0, v1.0.1)' },
        { status: 400 }
      );
    }

    const created = await transaction(async (client) => {
      const openResult = await client.query<Version>(
        `SELECT id, version FROM versions WHERE status = 'open' LIMIT 1`
      );
      if (openResult.rows.length > 0) {
        throw new Error(`OPEN_VERSION_EXISTS:${openResult.rows[0].version}`);
      }

      const existing = await client.query(
        'SELECT id FROM versions WHERE version = $1',
        [version]
      );
      if (existing.rows.length > 0) {
        throw new Error(`VERSION_EXISTS:${version}`);
      }

      const versionResult = await client.query<Version>(
        `INSERT INTO versions (version, created_by)
         VALUES ($1, $2)
         RETURNING *`,
        [version, created_by || null]
      );
      const newVersion = versionResult.rows[0];

      if (Array.isArray(bullets)) {
        for (const bullet of bullets) {
          if (!bullet?.clickup_url) continue;
          const urlMatch = String(bullet.clickup_url).match(
            /clickup\.com\/t\/([a-z0-9]+)/i
          );
          const clickupId = urlMatch ? urlMatch[1] : bullet.clickup_url;
          await client.query(
            `INSERT INTO incident_links (
              version_id, clickup_id, clickup_url, title, document_type,
              description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              newVersion.id,
              clickupId,
              bullet.clickup_url,
              bullet.title || null,
              bullet.document_type || null,
              bullet.description || null,
              created_by || null,
            ]
          );
        }
      }

      return newVersion;
    });

    return NextResponse.json(
      {
        success: true,
        message: `Version ${created.version} created`,
        version: created,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.startsWith('VERSION_EXISTS:')) {
      return NextResponse.json(
        { error: `Version ${message.split(':')[1]} already exists` },
        { status: 409 }
      );
    }
    if (message.startsWith('OPEN_VERSION_EXISTS:')) {
      const openVersion = message.split(':')[1];
      return NextResponse.json(
        {
          error: `Ya hay un borrador de versión abierto (${openVersion}). Ciérralo en el changelog antes de crear uno nuevo.`,
        },
        { status: 409 }
      );
    }

    console.error('Error creating version:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
