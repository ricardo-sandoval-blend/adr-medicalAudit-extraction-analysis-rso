'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, X, ChevronRight, ExternalLink } from 'lucide-react';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/config';
import { useKeycloak } from '@/lib/keycloak';
import { createVersion, VersionBulletInput } from '@/lib/api-client';

interface CreateVersionModalProps {
  onVersionCreated?: () => void;
  // Only one version draft may be open at a time. When true, creating a new
  // version is blocked until the open draft is closed.
  hasOpenVersion?: boolean;
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

export function CreateVersionModal({
  onVersionCreated,
  hasOpenVersion = false,
}: CreateVersionModalProps) {
  const { user } = useKeycloak();
  const [open, setOpen] = useState(false);
  const [major, setMajor] = useState('1');
  const [minor, setMinor] = useState('0');
  const [patch, setPatch] = useState('0');

  // Each bullet is one worked issue: document type + the change it made +
  // the ClickUp link. Bullets are grouped by document type on the Changelog
  // page once created.
  const [bullets, setBullets] = useState<VersionBulletInput[]>([]);
  const [currentDocType, setCurrentDocType] = useState<string>(DOCUMENT_TYPES[0]);
  const [currentDescription, setCurrentDescription] = useState('');
  const [currentClickupUrl, setCurrentClickupUrl] = useState(CLICKUP_BASE_URL);
  const [currentTitle, setCurrentTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVersion, setLastVersion] = useState<string | null>(null);
  const [suggestedVersion, setSuggestedVersion] = useState<string | null>(null);

  const version = `v${major}.${minor}.${patch}`;

  function incrementPatchVersion(versionStr: string): string {
    const match = versionStr.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (match) {
      const majorNum = match[1];
      const minorNum = match[2];
      const patchNum = parseInt(match[3] || '0') + 1;
      return `v${majorNum}.${minorNum}.${patchNum}`;
    }
    return 'v1.0.0';
  }

  useEffect(() => {
    if (!open) return;

    const fetchLastVersion = async () => {
      try {
        const response = await fetch('/api/versions');
        if (response.ok) {
          const data = await response.json();
          if (data.versions && data.versions.length > 0) {
            const latest = data.versions[0].version;
            setLastVersion(latest);
            setSuggestedVersion(incrementPatchVersion(latest));
          } else {
            setSuggestedVersion('v1.0.0');
          }
        }
      } catch (err) {
        console.error('Failed to fetch versions:', err);
        setSuggestedVersion('v1.0.0');
      }
    };

    fetchLastVersion();
  }, [open]);

  const applySuggestedVersion = () => {
    if (suggestedVersion) {
      const match = suggestedVersion.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
      if (match) {
        setMajor(match[1]);
        setMinor(match[2]);
        setPatch(match[3]);
      }
    }
  };

  const handleAddBullet = () => {
    const clickupUrl = currentClickupUrl.trim();
    if (
      !currentDocType ||
      !currentDescription.trim() ||
      !clickupUrl ||
      clickupUrl === CLICKUP_BASE_URL
    ) {
      return;
    }

    setBullets([
      ...bullets,
      {
        document_type: currentDocType,
        description: currentDescription.trim(),
        clickup_url: clickupUrl,
        title: currentTitle.trim() || undefined,
      },
    ]);
    setCurrentDescription('');
    setCurrentClickupUrl(CLICKUP_BASE_URL);
    setCurrentTitle('');
  };

  const handleRemoveBullet = (index: number) => {
    setBullets(bullets.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!version.match(/^v\d+\.\d+\.\d+$/)) {
      setError('Version must be format vX.Y.Z (e.g., v1.0.0, v1.0.1)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await createVersion({
        version,
        created_by: user?.email || user?.name,
        bullets,
      });

      // Reset form
      setMajor('1');
      setMinor('0');
      setPatch('0');
      setBullets([]);
      setCurrentDescription('');
      setCurrentClickupUrl(CLICKUP_BASE_URL);
      setCurrentTitle('');
      setOpen(false);
      onVersionCreated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create version'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={hasOpenVersion}
          title={
            hasOpenVersion
              ? 'Ya hay un borrador de versión abierto. Ciérralo antes de crear uno nuevo.'
              : undefined
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo borrador
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto !gap-6 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Nuevo borrador de versión</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pr-4">
          {error && (
            <div className="rounded-lg bg-red-100 p-3 text-red-800 dark:bg-red-900 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Version */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                VERSIÓN ANTERIOR
              </label>
              {lastVersion ? (
                <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-3">
                  <span className="font-mono">{lastVersion}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  {suggestedVersion && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applySuggestedVersion}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      Usar {suggestedVersion}
                    </Button>
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Primera versión: v1.0.0
                </p>
              )}
            </div>

            <label className="text-sm font-medium block mb-3">
              Nueva Versión
            </label>
            <div className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs text-slate-500">Major</label>
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={major}
                  onChange={(e) => setMajor(e.target.value || '0')}
                  className="w-16 h-10 text-center text-lg font-semibold"
                />
              </div>

              <span className="text-3xl font-light text-slate-400 mt-6">.</span>

              <div className="flex flex-col items-center gap-1">
                <label className="text-xs text-slate-500">Minor</label>
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={minor}
                  onChange={(e) => setMinor(e.target.value || '0')}
                  className="w-16 h-10 text-center text-lg font-semibold"
                />
              </div>

              <span className="text-3xl font-light text-slate-400 mt-6">.</span>

              <div className="flex flex-col items-center gap-1">
                <label className="text-xs text-slate-500">Patch</label>
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={patch}
                  onChange={(e) => setPatch(e.target.value || '0')}
                  className="w-16 h-10 text-center text-lg font-semibold"
                />
              </div>

              <div className="text-center ml-4 text-slate-600 dark:text-slate-400 text-sm font-mono">
                {version}
              </div>
            </div>
          </div>

          {/* Bullets: document + descripción + issue */}
          <div>
            <label className="text-sm font-medium block mb-3">
              Cambios (se agrupan por documento al visualizarse)
            </label>

            {/* Add bullet form */}
            <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  Documento
                </label>
                <select
                  value={currentDocType}
                  onChange={(e) => setCurrentDocType(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type} - {DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  ¿En qué vas a trabajar?
                </label>
                <textarea
                  placeholder="Describe el plan para este issue..."
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-2 text-sm h-16"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  Issue de ClickUp
                </label>
                <div className="relative">
                  <ClickUpIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <Input
                    placeholder="Agrega la URL de ClickUp"
                    value={currentClickupUrl}
                    onChange={(e) => setCurrentClickupUrl(e.target.value)}
                    className="text-sm pl-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  Título (opcional)
                </label>
                <Input
                  placeholder="Título del issue"
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                />
              </div>

              <Button
                size="sm"
                onClick={handleAddBullet}
                disabled={
                  !currentDocType ||
                  !currentDescription.trim() ||
                  !currentClickupUrl.trim() ||
                  currentClickupUrl.trim() === CLICKUP_BASE_URL
                }
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>

            {/* Bullets list */}
            {bullets.length > 0 && (
              <div className="space-y-3">
                {bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline">{bullet.document_type}</Badge>
                      <button
                        onClick={() => handleRemoveBullet(idx)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 whitespace-pre-wrap">
                      {bullet.description}
                    </p>
                    <a
                      href={bullet.clickup_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline min-w-0"
                    >
                      <ClickUpIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {bullet.title ||
                          extractClickupTaskId(bullet.clickup_url) ||
                          bullet.clickup_url}
                      </span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading || !version}>
              {loading ? 'Creando...' : 'Crear Versión'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
