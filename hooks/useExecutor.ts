'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dataset, Radicado, ExecutionCriteria } from '@/lib/types';
import {
  getDraftExecution,
  createExecution,
  updateExecution,
} from '@/lib/api-client';

interface PreviousExecution {
  date: string;
  radicado: string;
  nit: string;
  type: 'total' | 'sample';
}

interface ExecutorState {
  step: number;
  draftExecutionId?: string;
  selectedDataset?: Dataset;
  selectedIPs: string[];
  mandatoryRadicados: Radicado[];
  selectedPDFs: string[];
  sampleSize: number;
  executionType: 'total' | 'sample';
  previousExecution?: PreviousExecution | null;
}

const initialState: ExecutorState = {
  step: 1,
  selectedDataset: undefined,
  selectedIPs: [],
  mandatoryRadicados: [],
  selectedPDFs: [],
  sampleSize: 0,
  executionType: 'total',
  previousExecution: null,
};

// Drives the Executor wizard AND keeps the day's mandatory radicados
// persisted against a 'draft' execution tied to the open version, so the
// whole team accumulating radicados during the day sees the same state and
// it survives reloads. The draft is only finalized (draft -> running) when
// "Iniciar" is pressed (see executeExtraction in Executor.tsx).
export function useExecutor(versionId: string | undefined, datasets: Dataset[]) {
  const [state, setState] = useState<ExecutorState>(initialState);
  const [draftLoading, setDraftLoading] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Load the existing draft execution for the open version, if any, and
  // hydrate the wizard from it (radicados, dataset, sample size).
  useEffect(() => {
    if (!versionId || datasets.length === 0) return;
    let cancelled = false;

    const loadDraft = async () => {
      setDraftLoading(true);
      try {
        const draft = await getDraftExecution(versionId);
        if (cancelled || !draft) return;
        const dataset = datasets.find((d) => d.id === draft.dataset_id);
        setState((s) => ({
          ...s,
          draftExecutionId: draft.id,
          selectedDataset: dataset ?? s.selectedDataset,
          mandatoryRadicados: draft.criteria?.mandatory_radicados || [],
          selectedIPs: draft.criteria?.ips || [],
          sampleSize: draft.total_documents || s.sampleSize,
          step: dataset ? 2 : s.step,
        }));
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    };

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [versionId, datasets]);

  // Creates the draft execution on first meaningful change, or patches it if
  // it already exists. Fire-and-forget from the caller's perspective: local
  // state updates immediately, persistence happens in the background.
  const ensureDraft = useCallback(
    async (patch: {
      dataset_id?: string;
      criteria?: ExecutionCriteria;
      total_documents?: number;
      pdf_count?: number;
    }) => {
      if (!versionId) return null;
      const datasetId = patch.dataset_id ?? stateRef.current.selectedDataset?.id;
      if (!datasetId) return null;

      if (stateRef.current.draftExecutionId) {
        return updateExecution(stateRef.current.draftExecutionId, {
          dataset_id: datasetId,
          ...patch,
        });
      }

      const created = await createExecution({
        version_id: versionId,
        dataset_id: datasetId,
        status: 'draft',
        criteria: patch.criteria ?? { ips: [], mandatory_radicados: [] },
        total_documents: patch.total_documents ?? 0,
        pdf_count: patch.pdf_count ?? 0,
      });
      setState((s) => ({ ...s, draftExecutionId: created.id }));
      return created;
    },
    [versionId]
  );

  const goToStep = (step: number) => {
    setState((s) => ({ ...s, step }));
  };

  const setDataset = (dataset: Dataset) => {
    setState((s) => ({ ...s, selectedDataset: dataset, step: 2 }));
    ensureDraft({ dataset_id: dataset.id, pdf_count: dataset.pdf_count }).catch(
      () => {}
    );
  };

  const setSampleSize = (size: number) => {
    setState((s) => ({ ...s, sampleSize: size }));
    ensureDraft({ total_documents: size }).catch(() => {});
  };

  const setSelectedIPs = (ips: string[]) => {
    setState((s) => ({ ...s, selectedIPs: ips }));
    ensureDraft({
      criteria: {
        ips,
        mandatory_radicados: stateRef.current.mandatoryRadicados,
      },
    }).catch(() => {});
  };

  const setMandatoryRadicados = (radicados: Radicado[]) => {
    setState((s) => ({ ...s, mandatoryRadicados: radicados }));
    ensureDraft({
      criteria: { ips: stateRef.current.selectedIPs, mandatory_radicados: radicados },
    }).catch(() => {});
  };

  const setSelectedPDFs = (pdfs: string[]) => {
    setState((s) => ({ ...s, selectedPDFs: pdfs }));
  };

  const getCriteria = (): ExecutionCriteria => ({
    ips: state.selectedIPs,
    mandatory_radicados: state.mandatoryRadicados,
  });

  const setExecutionType = (type: 'total' | 'sample') => {
    setState((s) => ({ ...s, executionType: type }));
  };

  const setPreviousExecution = (execution: PreviousExecution | null) => {
    setState((s) => ({ ...s, previousExecution: execution }));
  };

  const reset = () => {
    setState(initialState);
  };

  return {
    ...state,
    draftLoading,
    goToStep,
    setDataset,
    setSampleSize,
    setSelectedIPs,
    setMandatoryRadicados,
    setSelectedPDFs,
    setExecutionType,
    setPreviousExecution,
    getCriteria,
    reset,
  };
}
