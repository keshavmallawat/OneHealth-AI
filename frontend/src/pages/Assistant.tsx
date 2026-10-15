import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  FileText,
  Info,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import { assistantApi } from '../services/assistantApi';
import type { AssistantAnswer } from '../services/assistantApi';
import { apiErrorMessage } from '../services/apiClient';
import AppShell from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  MedicalDisclaimer,
  Panel,
  PanelHeader,
  PageHeader,
  Spinner,
} from '../components/ui';

interface Turn {
  id: number;
  question: string;
  answer?: AssistantAnswer;
  error?: string;
  pending?: boolean;
}

/** Assistant Clinical Safety & Ethical Guardrails */
const Boundaries: React.FC = () => (
  <Panel className="overflow-hidden shadow-xs">
    <PanelHeader title="Clinical Guardrails & Scope" icon={Info} />
    <div className="space-y-4 p-5 text-xs leading-relaxed">
      <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
        <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          What It Does
        </p>
        <ul className="space-y-1 text-slate-600 dark:text-slate-300">
          <li>• Explains extracted biometric values against reference intervals</li>
          <li>• Clarifies medical terminology in plain language</li>
          <li>• Analyzes historical parameter movements across your uploaded reports</li>
        </ul>
      </div>

      <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3.5">
        <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-1.5">
          <AlertOctagon className="h-3.5 w-3.5" />
          Strict Limitations
        </p>
        <ul className="space-y-1 text-slate-600 dark:text-slate-300">
          <li>• Does not provide diagnoses or prescribe medication</li>
          <li>• Does not adjust clinical treatment regimens</li>
          <li>• Answers only from your uploaded records — zero external data guessing</li>
        </ul>
      </div>
    </div>
  </Panel>
);

const AnswerCard: React.FC<{ turn: Turn }> = ({ turn }) => {
  const answer = turn.answer;

  return (
    <div className="space-y-3">
      {/* User Question */}
      <div className="flex items-end justify-end gap-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-xs bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm text-white shadow-sm shadow-sky-600/20">
          <p>{turn.question}</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-slate-600 dark:text-slate-300 shrink-0 mb-0.5">
          <User className="h-4 w-4" />
        </div>
      </div>

      {/* Assistant Answer */}
      <div className="flex items-start justify-start gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white grid place-items-center shadow-md shadow-sky-500/20 shrink-0 mt-0.5">
          <Bot className="h-4.5 w-4.5" />
        </div>

        <div className="max-w-[90%] min-w-0 flex-1">
          {turn.pending ? (
            <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-500 shadow-xs">
              <Spinner className="h-4 w-4 text-sky-600" />
              <span>Analyzing your laboratory results…</span>
            </div>
          ) : turn.error ? (
            <Alert tone="error">{turn.error}</Alert>
          ) : answer ? (
            <div
              className={`rounded-2xl rounded-tl-xs border p-4 sm:p-5 shadow-xs ${
                answer.refused
                  ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900'
              }`}
            >
              {answer.refused && (
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Outside Assistant Clinical Scope
                </div>
              )}

              <div className="space-y-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {answer.answer.split('\n').filter(Boolean).map((line, index) => (
                  <p key={index} className={line.startsWith('- ') ? 'pl-3 flex items-start gap-2' : undefined}>
                    {line.startsWith('- ') ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0 mt-2" />
                        <span>{line.slice(2)}</span>
                      </>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>

              {answer.citations.length > 0 && (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Citations & Source Documents
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {answer.citations
                      .filter((c, index, all) => all.findIndex((x) => x.recordId === c.recordId) === index)
                      .map((citation) => (
                        <li key={citation.recordId}>
                          <Link
                            to={`/reports/${citation.recordId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/30 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{citation.fileName}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <Badge tone={answer.source === 'openai' ? 'primary' : 'neutral'}>
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                  {answer.source === 'openai' ? 'Grounded LLM Summary' : 'Deterministic Explainer'}
                </Badge>
                <span className="text-[11px] text-slate-400">
                  Synthesized from {answer.groundedIn.analysedRecords} report{answer.groundedIn.analysedRecords === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const Assistant: React.FC = () => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [disclaimer, setDisclaimer] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    assistantApi.suggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const id = Date.now();
    setTurns((current) => [...current, { id, question: trimmed, pending: true }]);
    setQuestion('');
    setBusy(true);
    try {
      const answer = await assistantApi.ask(trimmed);
      setDisclaimer(answer.disclaimer);
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, answer, pending: false } : turn))
      );
    } catch (err) {
      const message = apiErrorMessage(err, 'The assistant could not answer that.');
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, error: message, pending: false } : turn))
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Clinical Assistant"
        description="Grounded natural language answers strictly built from your uploaded medical results with traceable document citations."
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Main Chat Panel */}
        <Panel className="flex min-w-0 min-h-[34rem] flex-col lg:col-span-2 overflow-hidden shadow-xs">
          <PanelHeader
            title="Interactive Conversation"
            description="Responses are mathematically grounded in your reports"
            icon={MessageSquareText}
          />

          {/* Messages Area */}
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
            {turns.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 text-sky-600 dark:text-sky-400 shadow-sm">
                  <Bot className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ask about your medical results
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every answer references laboratory parameters from your own reports. Inquire about out-of-range biomarkers, HbA1c, or changes over time.
                </p>

                {suggestions.length > 0 && (
                  <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => ask(suggestion)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs transition hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer active:scale-[0.98]"
                      >
                        <Sparkles className="h-3 w-3 text-sky-500" aria-hidden="true" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              turns.map((turn) => <AnswerCard key={turn.id} turn={turn} />)
            )}
            <div ref={endRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
            className="border-t border-slate-200/80 dark:border-slate-800/80 p-4 bg-slate-50/50 dark:bg-slate-900/50"
          >
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your test results (e.g. What is my cholesterol and is it high?)"
                aria-label="Ask a question about your results"
                maxLength={500}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-xs"
              />
              <Button type="submit" loading={busy} disabled={!question.trim()} className="px-5">
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Ask</span>
              </Button>
            </div>

            {turns.length > 0 && suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </form>
        </Panel>

        {/* Guardrails and Disclaimers Sidebar */}
        <div className="space-y-6">
          <Boundaries />
          <MedicalDisclaimer text={disclaimer || undefined} />
        </div>
      </div>
    </AppShell>
  );
};

export default Assistant;
