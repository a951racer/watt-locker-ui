/**
 * PLAN-059: Collapsible Step/Block Template tray for the activity planner.
 *
 * A left-side rail that lists the authenticated user's Step Templates and Block
 * Templates for QUICK INSERTION (click → inserts into the activity). It is not a
 * template manager: no CRUD here. Templates are loaded via the existing
 * PLAN-057/058 API clients.
 *
 * Insertion itself (materialization) is handled by the parent via the
 * onInsertStep / onInsertBlock callbacks — this component only lists and emits
 * click events.
 */
import { useState, useEffect, useCallback } from 'react';
import { listStepTemplates, type StepTemplate } from '../api/stepTemplates';
import { listBlockTemplates, type BlockTemplate } from '../api/blockTemplates';

export interface TemplateTrayProps {
  onInsertStep: (template: StepTemplate) => void;
  onInsertBlock: (template: BlockTemplate) => void;
}

export default function TemplateTray({ onInsertStep, onInsertBlock }: TemplateTrayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
  const [blockTemplates, setBlockTemplates] = useState<BlockTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [steps, blocks] = await Promise.all([listStepTemplates(), listBlockTemplates()]);
      setStepTemplates(steps);
      setBlockTemplates(blocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setStepTemplates([]);
      setBlockTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Collapsed rail — a compact control to reopen the tray.
  if (collapsed) {
    return (
      <div
        className="flex-shrink-0 w-10 bg-charcoalGray rounded-lg flex flex-col items-center py-3"
        data-testid="template-tray-collapsed"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-brightCyan hover:text-pureWhite text-sm"
          title="Open templates"
          aria-label="Open templates"
          data-testid="template-tray-expand-btn"
        >
          »
        </button>
        <span className="mt-3 text-xs text-softFog [writing-mode:vertical-rl] rotate-180 select-none">
          Templates
        </span>
      </div>
    );
  }

  return (
    <aside
      className="flex-shrink-0 w-60 bg-charcoalGray rounded-lg p-4 space-y-4 self-start"
      data-testid="template-tray"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pureWhite">Templates</h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-softFog hover:text-pureWhite text-sm"
          title="Collapse templates"
          aria-label="Collapse templates"
          data-testid="template-tray-collapse-btn"
        >
          «
        </button>
      </div>

      {loading && (
        <p className="text-xs text-softFog" data-testid="template-tray-loading">Loading templates…</p>
      )}
      {error && !loading && (
        <p className="text-xs text-red-400" data-testid="template-tray-error">{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* Step Templates */}
          <div data-testid="tray-step-templates">
            <h3 className="text-xs uppercase tracking-wide text-softFog mb-1">Steps</h3>
            {stepTemplates.length === 0 ? (
              <p className="text-xs text-lightSilver" data-testid="tray-step-templates-empty">No step templates.</p>
            ) : (
              <ul className="space-y-1">
                {stepTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onInsertStep(t)}
                      className="w-full text-left px-2 py-1.5 text-sm text-lightSilver rounded hover:bg-steelBlue/50 truncate"
                      data-testid={`tray-step-${t.id}`}
                      title={`Insert ${t.name}`}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Block Templates */}
          <div data-testid="tray-block-templates">
            <h3 className="text-xs uppercase tracking-wide text-softFog mb-1">Blocks</h3>
            {blockTemplates.length === 0 ? (
              <p className="text-xs text-lightSilver" data-testid="tray-block-templates-empty">No block templates.</p>
            ) : (
              <ul className="space-y-1">
                {blockTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onInsertBlock(t)}
                      className="w-full text-left px-2 py-1.5 text-sm text-lightSilver rounded hover:bg-steelBlue/50 flex items-center justify-between gap-2"
                      data-testid={`tray-block-${t.id}`}
                      title={`Insert ${t.name}`}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-xs text-softFog whitespace-nowrap">{t.repeatCount}×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
