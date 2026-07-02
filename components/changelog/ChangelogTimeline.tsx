'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  AlertCircle,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  User,
  CircleDot,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { Execution, IncidentLink } from '@/lib/types';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from '@/lib/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKeycloak } from '@/lib/keycloak';
import {
  addIncident,
  removeIncident,
  closeIncident,
  editIncident,
  rollbackIncident,
  closeVersion,
} from '@/lib/api-client';

export interface VersionEntry {
  id: string;
  version: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string;
  created_by?: string;
  incidents: IncidentLink[];
  executions: Execution[];
}

interface ChangelogTimelineProps {
  versions: VersionEntry[];
  onChanged: () => void;
}

function ClickUpIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/clickup.svg" alt="ClickUp" className={className} />
  );
}

function extractClickupTaskId(url: string): string | null {
  const match = url.match(/clickup\.com\/t\/([a-z0-9]+)/i);
  return match ? match[1] : null;
}

const CLICKUP_BASE_URL = 'https://app.clickup.com/t/';

function executionStatusVariant(status: Execution['status']) {
  if (status === 'success') return 'default' as const;
  if (status === 'failed') return 'destructive' as const;
  if (status === 'draft') return 'outline' as const;
  return 'secondary' as const;
}

function safeFormat(value?: string) {
  if (!value) return null;
  try {
    return format(new Date(value), 'PPp');
  } catch {
    return value;
  }
}

// Groups bullets (incident_links) by document_type for display, preserving
// insertion order of both groups and bullets within each group.
function groupByDocumentType(bullets: IncidentLink[]) {
  const groups = new Map<string, IncidentLink[]>();
  for (const bullet of bullets) {
    const key = bullet.document_type || 'Sin documento';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bullet);
  }
  return Array.from(groups.entries());
}

// A single bullet: opens with just a plan (document type + description +
// issue link); can later be closed with its resolution — what was actually
// implemented to solve it. Independent of the version's own open/closed
// status, though bullets can only be edited while the version is still open.
function BulletRow({
  bullet,
  isVersionOpen,
  onChanged,
  onRemove,
}: {
  bullet: IncidentLink;
  isVersionOpen: boolean;
  onChanged: () => void;
  onRemove: (id: string) => void;
}) {
  const { user } = useKeycloak();
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showRollbackForm, setShowRollbackForm] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [editDocType, setEditDocType] = useState(bullet.document_type || DOCUMENT_TYPES[0]);
  const [editDescription, setEditDescription] = useState(bullet.description || '');
  const [editClickupUrl, setEditClickupUrl] = useState(bullet.clickup_url);
  const [editTitle, setEditTitle] = useState(bullet.title || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBulletOpen = bullet.status === 'open';
  const isResolved = bullet.status === 'closed';
  const isReverted = bullet.status === 'reverted';

  const handleEditBullet = async () => {
    if (!editClickupUrl.trim() || !editDescription.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await editIncident(bullet.id, {
        clickupUrl: editClickupUrl.trim(),
        title: editTitle.trim() || undefined,
        documentType: editDocType,
        description: editDescription.trim(),
      });
      setShowEditForm(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to edit bullet'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCloseBullet = async () => {
    if (!resolution.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await closeIncident(bullet.id, {
        resolution: resolution.trim(),
        closedBy: user?.email || user?.name,
      });
      setShowCloseForm(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to close bullet'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackReason.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await rollbackIncident(bullet.id, {
        reason: rollbackReason.trim(),
        revertedBy: user?.email || user?.name,
      });
      setShowRollbackForm(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to rollback bullet'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
      <Badge variant={isBulletOpen ? 'outline' : isReverted ? 'destructive' : 'secondary'}>
        {isBulletOpen ? (
          <span className="flex items-center gap-1">
            <CircleDot className="h-3 w-3" />
            En progreso
          </span>
        ) : isReverted ? (
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            Revertido
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Resuelto
          </span>
        )}
      </Badge>

      {bullet.description && (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Plan:{' '}
          </span>
          {bullet.description}
        </p>
      )}

      {bullet.resolution && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Solución:{' '}
          </span>
          {bullet.resolution}
        </p>
      )}

      {bullet.revert_reason && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          <span className="text-xs font-medium text-red-500 dark:text-red-400">
            Razón del rollback:{' '}
          </span>
          {bullet.revert_reason}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <a
          href={bullet.clickup_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm"
        >
          <ClickUpIcon className="h-4 w-4 flex-shrink-0" />
          <span className="text-slate-900 dark:text-white">
            {bullet.title ||
              extractClickupTaskId(bullet.clickup_url) ||
              'Ver issue'}
          </span>
          <ExternalLink className="h-3 w-3 flex-shrink-0 text-slate-400" />
        </a>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {bullet.created_by && (
            <span className="flex items-center gap-1" title="Registrado por">
              <User className="h-3 w-3" />
              {bullet.created_by}
            </span>
          )}
          {isResolved && bullet.closed_by && (
            <span className="flex items-center gap-1" title="Resuelto por">
              <CheckCircle2 className="h-3 w-3" />
              {bullet.closed_by}
            </span>
          )}
          {isReverted && bullet.reverted_by && (
            <span className="flex items-center gap-1" title="Revertido por">
              <RotateCcw className="h-3 w-3" />
              {bullet.reverted_by}
            </span>
          )}
          {isVersionOpen && isBulletOpen && (
            <button
              onClick={() => {
                setShowEditForm(false);
                setShowCloseForm((v) => !v);
              }}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Cerrar
            </button>
          )}
          {isVersionOpen && isBulletOpen && (
            <button
              onClick={() => {
                setShowCloseForm(false);
                setShowEditForm((v) => !v);
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
          )}
          {isVersionOpen && isResolved && (
            <button
              onClick={() => setShowRollbackForm((v) => !v)}
              className="text-amber-600 hover:underline dark:text-amber-400"
            >
              Rollback
            </button>
          )}
          {isVersionOpen && (
            <button
              onClick={() => onRemove(bullet.id)}
              className="text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {showEditForm && (
        <div className="mt-3 space-y-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
          {error && (
            <div className="rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
              {error}
            </div>
          )}
          <select
            value={editDocType}
            onChange={(e) => setEditDocType(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type} - {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <textarea
            placeholder="¿En qué vas a trabajar?"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="h-16 w-full rounded border border-input bg-background px-2 py-2 text-sm"
          />
          <Input
            placeholder="https://app.clickup.com/t/abc123"
            value={editClickupUrl}
            onChange={(e) => setEditClickupUrl(e.target.value)}
          />
          <Input
            placeholder="Título del issue (opcional)"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleEditBullet}
              disabled={saving || !editClickupUrl.trim() || !editDescription.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {showCloseForm && (
        <div className="mt-3 space-y-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
          {error && (
            <div className="rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
              {error}
            </div>
          )}
          <textarea
            placeholder="¿Qué implementaste para solucionarlo?"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="h-16 w-full rounded border border-input bg-background px-2 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCloseBullet}
              disabled={saving || !resolution.trim()}
            >
              {saving ? 'Guardando...' : 'Marcar como resuelto'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCloseForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {showRollbackForm && (
        <div className="mt-3 space-y-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
          {error && (
            <div className="rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
              {error}
            </div>
          )}
          <textarea
            placeholder="¿Por qué se revirtió este cambio?"
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            className="h-16 w-full rounded border border-input bg-background px-2 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRollback}
              disabled={saving || !rollbackReason.trim()}
            >
              {saving ? 'Guardando...' : 'Confirmar rollback'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRollbackForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VersionCardEntry({
  entry,
  isLatest,
  onChanged,
}: {
  entry: VersionEntry;
  isLatest: boolean;
  onChanged: () => void;
}) {
  const { user } = useKeycloak();
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [clickupUrl, setClickupUrl] = useState(CLICKUP_BASE_URL);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isOpen = entry.status === 'open';
  const groupedBullets = groupByDocumentType(entry.incidents);

  const handleAddIssue = async () => {
    const trimmedClickupUrl = clickupUrl.trim();
    if (
      !trimmedClickupUrl ||
      trimmedClickupUrl === CLICKUP_BASE_URL ||
      !description.trim()
    ) {
      return;
    }
    try {
      setSaving(true);
      setFormError(null);

      await addIncident({
        versionId: entry.id,
        clickupUrl: trimmedClickupUrl,
        title: title.trim() || trimmedClickupUrl,
        documentType,
        description: description.trim(),
        createdBy: user?.email || user?.name,
      });

      setClickupUrl(CLICKUP_BASE_URL);
      setTitle('');
      setDescription('');
      setShowAddIssue(false);
      onChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to add issue'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveIncident = async (incidentId: string) => {
    try {
      await removeIncident(incidentId);
      onChanged();
    } catch (err) {
      console.error('Failed to remove incident:', err);
    }
  };

  const handleClose = async () => {
    try {
      setClosing(true);
      setFormError(null);
      await closeVersion(entry.id);
      onChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to close version'
      );
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Borrador de versión
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {entry.version}
              </h3>
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {isOpen ? 'Borrador' : 'Publicada'}
              </Badge>
              {isLatest && (
                <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                  Latest
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {safeFormat(entry.created_at)}
              </span>
              {entry.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {entry.created_by}
                </span>
              )}
              {entry.closed_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Publicada {safeFormat(entry.closed_at)}
                </span>
              )}
            </div>
          </div>

          {isOpen && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={closing}
            >
              <Lock className="h-4 w-4 mr-1" />
              {closing ? 'Publicando...' : 'Publicar versión'}
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {formError && (
          <div className="rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
            {formError}
          </div>
        )}

        {/* Executions run against this version */}
        {entry.executions.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Ejecuciones ({entry.executions.length})
            </h4>
            <div className="space-y-2">
              {entry.executions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={executionStatusVariant(exec.status)}>
                      {exec.status.toUpperCase()}
                    </Badge>
                    <span className="text-slate-700 dark:text-slate-300">
                      {exec.dataset_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{exec.total_documents} docs</span>
                    <span className="text-green-600">
                      {exec.successful_count} ok
                    </span>
                    <span className="text-red-600">
                      {exec.error_count} err
                    </span>
                    <span>{safeFormat(exec.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bullets (issue + change), grouped by document type */}
        <div className={entry.executions.length > 0 ? 'border-t border-slate-200 pt-4 dark:border-slate-800' : ''}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FileText className="h-4 w-4" />
              Cambios
            </h4>
            {isOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddIssue((v) => !v)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            )}
          </div>

          {showAddIssue && (
            <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type} - {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="¿En qué vas a trabajar?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-16 w-full rounded border border-input bg-background px-2 py-2 text-sm"
              />
              <Input
                placeholder="Agrega la URL de ClickUp"
                value={clickupUrl}
                onChange={(e) => setClickupUrl(e.target.value)}
              />
              <Input
                placeholder="Título del issue (opcional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddIssue}
                  disabled={
                    saving ||
                    !clickupUrl.trim() ||
                    clickupUrl.trim() === CLICKUP_BASE_URL ||
                    !description.trim()
                  }
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddIssue(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {groupedBullets.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sin cambios registrados
            </p>
          ) : (
            <div className="space-y-5">
              {groupedBullets.map(([docType, bulletsForType]) => (
                <div key={docType}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {DOCUMENT_TYPE_LABELS[
                      docType as keyof typeof DOCUMENT_TYPE_LABELS
                    ] || docType}
                  </p>
                  <div className="space-y-2 pl-1">
                    {bulletsForType.map((bullet) => (
                      <BulletRow
                        key={bullet.id}
                        bullet={bullet}
                        isVersionOpen={isOpen}
                        onChanged={onChanged}
                        onRemove={handleRemoveIncident}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChangelogTimeline({
  versions,
  onChanged,
}: ChangelogTimelineProps) {
  return (
    <div className="relative mx-auto max-w-3xl space-y-0 py-8">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 h-full w-px bg-slate-200 dark:bg-slate-800 md:left-12" />

      {versions.map((entry, index) => (
        <div key={entry.id} className="relative mb-12 pl-24 md:pl-32">
          {/* Timeline dot */}
          <div className="absolute left-8 top-7 -translate-x-1/2 -translate-y-1/2 md:left-12">
            <div className="h-3 w-3 rounded-full bg-slate-900 dark:bg-slate-100" />
          </div>

          <VersionCardEntry
            entry={entry}
            isLatest={index === 0}
            onChanged={onChanged}
          />
        </div>
      ))}

      {versions.length === 0 && (
        <div className="absolute left-2 top-8 md:left-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      )}
    </div>
  );
}
