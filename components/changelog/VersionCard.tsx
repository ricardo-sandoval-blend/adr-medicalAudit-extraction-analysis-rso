'use client';

import { useState } from 'react';
import { ChangelogEntry, IncidentLink } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addIncident, removeIncident } from '@/lib/api-client';
import { format } from 'date-fns';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

interface VersionCardProps {
  entry: ChangelogEntry;
  onUpdate?: () => void;
}

export function VersionCard({ entry, onUpdate }: VersionCardProps) {
  const [showAddIncident, setShowAddIncident] = useState(false);
  const [incidentUrl, setIncidentUrl] = useState('');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidents, setIncidents] = useState(entry.incidents);

  const handleAddIncident = async () => {
    if (!incidentUrl || !incidentTitle) return;

    try {
      const incident = await addIncident({
        versionId: entry.version.id,
        clickupUrl: incidentUrl,
        title: incidentTitle,
      });
      setIncidents([...incidents, incident]);
      setIncidentUrl('');
      setIncidentTitle('');
      setShowAddIncident(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add incident:', error);
    }
  };

  const handleRemoveIncident = async (incidentId: string) => {
    try {
      await removeIncident(incidentId);
      setIncidents(incidents.filter((i) => i.id !== incidentId));
      onUpdate?.();
    } catch (error) {
      console.error('Failed to remove incident:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {entry.version.version}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(entry.version.created_at), 'PPpp')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metrics */}
        <div>
          <h4 className="mb-2 font-medium text-sm">Metrics</h4>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3">
            <div>
              <div className="text-xs text-muted-foreground">
                Documents
              </div>
              <div className="text-lg font-semibold">
                {entry.metrics_snapshot.total_documents}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Success Rate
              </div>
              <div className="text-lg font-semibold">
                {entry.metrics_snapshot.success_rate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Errors
              </div>
              <div className="text-lg font-semibold">
                {entry.metrics_snapshot.error_count}
              </div>
            </div>
          </div>
        </div>

        {/* Document Changes */}
        {(entry.field_changes?.length || 0) > 0 && (
          <div>
            <h4 className="mb-2 font-medium text-sm">Changes</h4>
            <div className="space-y-2">
              {entry.field_changes
                ?.filter((f) => f.type === 'added')
                .map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50">
                      Added
                    </Badge>
                    <code className="text-xs">{f.field}</code>
                  </div>
                ))}
              {entry.field_changes
                ?.filter((f) => f.type === 'removed')
                .map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50">
                      Removed
                    </Badge>
                    <code className="text-xs">{f.field}</code>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Incidents */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium text-sm">Incidents</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddIncident(!showAddIncident)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {showAddIncident && (
            <div className="space-y-2 rounded-lg bg-muted p-3 mb-3">
              <Input
                placeholder="Clickup URL"
                value={incidentUrl}
                onChange={(e) => setIncidentUrl(e.target.value)}
              />
              <Input
                placeholder="Title"
                value={incidentTitle}
                onChange={(e) => setIncidentTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddIncident}
                  disabled={!incidentUrl || !incidentTitle}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddIncident(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No incidents linked
            </p>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between rounded-lg bg-blue-50 p-2 dark:bg-blue-950"
                >
                  <a
                    href={inc.clickup_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 flex-1"
                  >
                    <span className="text-xs font-medium">
                      {inc.title}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => handleRemoveIncident(inc.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
