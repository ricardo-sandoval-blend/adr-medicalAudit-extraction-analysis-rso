import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { ChangelogEntry, DocumentChange, FieldChange, IncidentLink } from './types';

const CHANGELOG_PATH = process.env.CHANGELOG_PATH || join(process.cwd(), 'data', 'changelog');

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function getChangelogDir(): Promise<string> {
  await ensureDir(CHANGELOG_PATH);
  return CHANGELOG_PATH;
}

export async function readVersionMarkdown(
  version: string
): Promise<string | null> {
  try {
    const dir = await getChangelogDir();
    const filePath = join(dir, `${version}.md`);
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeVersionMarkdown(
  version: string,
  content: string
): Promise<void> {
  const dir = await getChangelogDir();
  const filePath = join(dir, `${version}.md`);
  await writeFile(filePath, content, 'utf-8');
}

export async function listVersions(): Promise<string[]> {
  try {
    const dir = await getChangelogDir();
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
      .sort()
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}

export function formatChangelogMarkdown(
  version: string,
  metrics: {
    total_documents: number;
    success_rate: number;
    error_count: number;
  },
  fieldChanges: FieldChange[],
  incidents: IncidentLink[] = []
): string {
  let md = `# Version ${version}\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n\n`;

  // Metrics section
  md += `## Metrics\n`;
  md += `- Documents Processed: ${metrics.total_documents}\n`;
  md += `- Success Rate: ${metrics.success_rate.toFixed(2)}%\n`;
  md += `- Errors: ${metrics.error_count}\n\n`;

  // Field changes
  if (fieldChanges.length > 0) {
    md += `## Field Changes\n`;

    const added = fieldChanges.filter((f) => f.type === 'added');
    if (added.length > 0) {
      md += `### Added\n`;
      added.forEach((f) => {
        md += `- \`${f.field}\`\n`;
      });
      md += '\n';
    }

    const removed = fieldChanges.filter((f) => f.type === 'removed');
    if (removed.length > 0) {
      md += `### Removed\n`;
      removed.forEach((f) => {
        md += `- \`${f.field}\`\n`;
      });
      md += '\n';
    }

    const modified = fieldChanges.filter((f) => f.type === 'modified');
    if (modified.length > 0) {
      md += `### Modified\n`;
      modified.forEach((f) => {
        md += `- \`${f.field}\`\n`;
      });
      md += '\n';
    }
  }

  // Incidents
  if (incidents.length > 0) {
    md += `## Incidents Resolved\n`;
    incidents.forEach((inc) => {
      md += `- [${inc.title}](${inc.clickup_url}) (${inc.clickup_id})\n`;
    });
    md += '\n';
  }

  return md;
}

export function parseChangelogMarkdown(content: string): {
  metrics?: {
    total_documents: number;
    success_rate: number;
    error_count: number;
  };
  fieldChanges: FieldChange[];
  incidents: IncidentLink[];
} {
  const result = {
    metrics: undefined as any,
    fieldChanges: [] as FieldChange[],
    incidents: [] as IncidentLink[],
  };

  // Parse metrics section
  const metricsMatch = content.match(/## Metrics\n([\s\S]*?)(?=##|$)/);
  if (metricsMatch) {
    const metricsText = metricsMatch[1];
    const docsMatch = metricsText.match(/Documents Processed: (\d+)/);
    const successMatch = metricsText.match(/Success Rate: ([\d.]+)%/);
    const errorsMatch = metricsText.match(/Errors: (\d+)/);

    if (docsMatch && successMatch && errorsMatch) {
      result.metrics = {
        total_documents: parseInt(docsMatch[1]),
        success_rate: parseFloat(successMatch[1]),
        error_count: parseInt(errorsMatch[1]),
      };
    }
  }

  // Parse field changes
  const fieldSection = content.match(/## Field Changes\n([\s\S]*?)(?=##|$)/);
  if (fieldSection) {
    const text = fieldSection[1];

    // Added
    const addedMatch = text.match(/### Added\n([\s\S]*?)(?=###|##|$)/);
    if (addedMatch) {
      const fields = addedMatch[1].match(/- `([^`]+)`/g) || [];
      fields.forEach((f) => {
        const field = f.replace(/- `|`/g, '');
        result.fieldChanges.push({ type: 'added', field });
      });
    }

    // Removed
    const removedMatch = text.match(/### Removed\n([\s\S]*?)(?=###|##|$)/);
    if (removedMatch) {
      const fields = removedMatch[1].match(/- `([^`]+)`/g) || [];
      fields.forEach((f) => {
        const field = f.replace(/- `|`/g, '');
        result.fieldChanges.push({ type: 'removed', field });
      });
    }

    // Modified
    const modifiedMatch = text.match(/### Modified\n([\s\S]*?)(?=###|##|$)/);
    if (modifiedMatch) {
      const fields = modifiedMatch[1].match(/- `([^`]+)`/g) || [];
      fields.forEach((f) => {
        const field = f.replace(/- `|`/g, '');
        result.fieldChanges.push({ type: 'modified', field });
      });
    }
  }

  return result;
}

export function parseDocumentChanges(content: string): DocumentChange[] {
  const documentChanges: DocumentChange[] = [];

  const section = content.match(/## Document Changes\n\n([\s\S]*?)(?=\n## |$)/);
  if (!section) return documentChanges;

  const blocks = section[1].split(/(?=^### )/m).filter((b) => b.trim());

  blocks.forEach((block) => {
    const headerMatch = block.match(/^### (\S+) - (.+)$/m);
    if (!headerMatch) return;

    const documentType = headerMatch[1];
    const afterHeader = block.slice(headerMatch.index! + headerMatch[0].length).trim();

    const fieldLines = afterHeader.match(/^- `([^`]+)`$/gm) || [];
    const fields = fieldLines.map((f) => f.replace(/^- `|`$/g, ''));

    const description = afterHeader
      .replace(/^- `([^`]+)`$/gm, '')
      .trim();

    documentChanges.push({ document_type: documentType, description, fields });
  });

  return documentChanges;
}

export function parseIncidentUrls(content: string): string[] {
  const section = content.match(/## Incidents Resolved\n([\s\S]*?)(?=\n## |$)/);
  if (!section) return [];

  const lines = section[1].match(/^- (\S+)$/gm) || [];
  return lines
    .map((line) => line.replace(/^- /, '').trim())
    .filter((url) => url.startsWith('http'));
}
