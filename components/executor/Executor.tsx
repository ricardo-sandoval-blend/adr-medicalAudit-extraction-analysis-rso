'use client';

import { useState } from 'react';
import { useExecutor } from '@/hooks/useExecutor';
import { useCurrentVersion } from '@/hooks/useCurrentVersion';
import { useDatasets } from '@/hooks/useDatasets';
import { DatasetSelector } from './DatasetSelector';
import { SampleCalculator } from './SampleCalculator';
import { MandatoryRadicados } from './MandatoryRadicados';
import { ExecutionReview } from './ExecutionReview';
import { ExecutionStatus } from './ExecutionStatus';
import { PreviousExecutionSelector } from './PreviousExecutionSelector';
import { executeExtraction } from '@/lib/api-client';
import { Execution } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Target } from 'lucide-react';

export function Executor() {
  const { version, loading: versionLoading } = useCurrentVersion();
  const { datasets } = useDatasets();
  const executor = useExecutor(version?.id, datasets);
  const [executing, setExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!version) {
      setError('No hay una versión abierta');
      return;
    }

    if (!executor.selectedDataset) {
      setError('Select a dataset');
      return;
    }

    if (executor.sampleSize <= 0) {
      setError('Sample size must be > 0');
      return;
    }

    try {
      setExecuting(true);
      setError(null);

      const response = await executeExtraction({
        execution_id: executor.draftExecutionId,
        dataset_id: executor.selectedDataset.id,
        pdf_paths: executor.selectedPDFs,
        criteria: executor.getCriteria(),
        sample_size: executor.sampleSize,
        version_id: version.id,
      });

      setFinished(false);
      setExecutionId(response.execution_id);
      executor.goToStep(5); // Go to status page
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Execution failed'
      );
    } finally {
      setExecuting(false);
    }
  };

  const handleNewExecution = () => {
    setExecutionId(null);
    setFinished(false);
    executor.reset();
  };

  const handleStatusChange = (execution: Execution) => {
    setFinished(execution.status === 'success' || execution.status === 'failed');
  };

  if (versionLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando borrador de versión...
      </div>
    );
  }

  if (!version) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Launch Execution</h1>
        </div>
        <Card className="max-w-2xl">
          <CardContent className="space-y-4 pt-6 text-center text-muted-foreground">
            <p>
              No hay un borrador de versión abierto. Crea uno desde
              Changelog para empezar a registrar radicados y ejecutar.
            </p>
            <a href="/changelog">
              <Button>Ir a Changelog</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (executionId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Execution in Progress</h1>
        </div>
        <ExecutionStatus
          executionId={executionId}
          onStatusChange={handleStatusChange}
        />
        {finished && (
          <Button onClick={handleNewExecution}>Nueva ejecución</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Launch Execution</h1>
        <p className="text-muted-foreground">
          Configure and launch a new extraction
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium">
              Borrador de versión · <span className="font-mono">{version.version}</span>
            </p>
            {version.created_by && (
              <p className="text-sm text-muted-foreground">
                Creado por {version.created_by}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Step 1 */}
        {executor.step >= 1 && (
          <DatasetSelector
            onSelect={executor.setDataset}
            selectedId={executor.selectedDataset?.id}
          />
        )}

        {/* Step 2 */}
        {executor.step >= 2 && executor.selectedDataset && (
          <SampleCalculator
            totalAvailable={executor.selectedDataset.pdf_count}
            onSampleChange={executor.setSampleSize}
            mandatoryRadicados={executor.mandatoryRadicados}
          />
        )}

        {/* Step 2b: Execution Type */}
        {executor.step >= 2 && executor.selectedDataset && (
          <div className="max-w-xs">
            <label className="text-sm font-medium mb-2 block">Execution Type</label>
            <Select
              value={executor.executionType}
              onValueChange={(v) =>
                executor.setExecutionType(v as 'total' | 'sample')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="sample">Sample</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 2c: Previous Execution Selector */}
        {executor.step >= 2 && executor.selectedDataset && (
          <PreviousExecutionSelector
            executionType={executor.executionType}
            selectedExecution={executor.previousExecution}
            onSelect={executor.setPreviousExecution}
          />
        )}

        {/* Step 2d: Mandatory Radicados */}
        {executor.step >= 2 && executor.selectedDataset && (
          <MandatoryRadicados
            radicados={executor.mandatoryRadicados}
            onChange={executor.setMandatoryRadicados}
            prestadoras={[
              { nit: '800149384', nombre: 'Prestadora A' },
              { nit: '800000001', nombre: 'Prestadora B' },
            ]}
          />
        )}

        {/* Step 3: Review */}
        {executor.step >= 3 && executor.selectedDataset && (
          <ExecutionReview
            dataset={executor.selectedDataset}
            sampleSize={executor.sampleSize}
            selectedPDFCount={executor.selectedPDFs.length || executor.sampleSize || 1}
            selectedIPs={executor.selectedIPs}
            mandatoryRadicados={executor.mandatoryRadicados}
            changelogVersion={version.version}
          />
        )}

        {/* Navigation Buttons */}
        {executor.step < 3 && (
          <div className="flex gap-3">
            {executor.step > 1 && (
              <Button
                variant="outline"
                onClick={() => executor.goToStep(executor.step - 1)}
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => executor.goToStep(executor.step + 1)}
              disabled={
                (executor.step === 1 && !executor.selectedDataset) ||
                (executor.step === 2 && executor.sampleSize <= 0)
              }
            >
              Next
            </Button>
          </div>
        )}

        {/* Execute Button */}
        {executor.step >= 3 && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => executor.goToStep(2)}
            >
              Back
            </Button>
            <Button
              onClick={handleExecute}
              disabled={
                executing ||
                !executor.selectedDataset ||
                executor.sampleSize <= 0
              }
            >
              {executing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Iniciar ejecución
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
