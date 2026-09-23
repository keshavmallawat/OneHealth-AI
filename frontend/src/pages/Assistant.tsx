import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, FileText, Info, MessageSquareText, Send, ShieldAlert, Sparkle } from 'lucide-react';
import { assistantApi } from '../services/assistantApi';
import type { AssistantAnswer } from '../services/assistantApi';
import { apiErrorMessage } from '../services/apiClient';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Button, Input, MedicalDisclaimer, Panel, PanelHeader, PageHeader, Spinner,
} from '../components/ui';

interface Turn {
  id: number;
  question: string;
  answer?: AssistantAnswer;
  error?: string;
  pending?: boolean;
}

/** What the assistant will and will not do, stated before it is used. */
const Boundaries: React.FC = () => (
  <Panel>
    <PanelHeader title="What this assistant does" icon={Info} />
    <div className="space-y-4 p-5 text-sm">
      <div>
        <p className="mb-1.5 font-medium text-normal">It can</p>
        <ul className="space-y-1 text-ink-soft">
          <li>• Tell you what a value in your own reports is, and how it compares with its range</li>
          <li>• Explain what a test measures in plain language</li>
          <li>• Say what is flagged in your latest report, and how a value has changed</li>
        </ul>
      </div>
      <div>
        <p className="mb-1.5 font-medium text-high">It will not</p>
        <ul className="space-y-1 text-ink-soft">
          <li>• Tell you whether you have a condition</li>
          <li>• Recommend or adjust any medication</li>
          <li>• Suggest a treatment plan</li>
          <li>• Use anyone else’s records, or invent a value you do not have</li>
        </ul>
      </div>
    </div>
  </Panel>
);

const AnswerCard: React.FC<{ turn: Turn }> = ({ turn }) => {
  const answer = turn.answer;

  return (
    <div className="space-y-3">
      {/* Question */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-white">
          {turn.question}
        </p>
      </div>

      {/* Answer */}
      <div className="flex justify-start">
        <div className="max-w-[92%] min-w-0">
          {turn.pending ? (
            <div className="inline-flex items-center gap-2 rounded-lg rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
              <Spinner className="h-3.5 w-3.5" />
              Looking at your records…
            </div>
          ) : turn.error ? (
            <Alert tone="error">{turn.error}</Alert>
          ) : answer ? (
            <div
              className={`rounded-lg rounded-bl-sm border px-4 py-3.5 ${
                answer.refused ? 'border-low-line bg-low-soft' : 'border-line bg-surface'
              }`}
            >
              {answer.refused && (
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-low">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Outside what this assistant can answer
                </p>
              )}

              <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
                {answer.answer.split('\n').filter(Boolean).map((line, index) => (
                  <p key={index} className={line.startsWith('- ') ? 'pl-3' : undefined}>
                    {line.startsWith('- ') ? `• ${line.slice(2)}` : line}
                  </p>
                ))}
              </div>

              {answer.citations.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="eyebrow mb-1.5">Based on</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {answer.citations
                      .filter((c, index, all) => all.findIndex((x) => x.recordId === c.recordId) === index)
                      .map((citation) => (
                        <li key={citation.recordId}>
                          <Link
                            to={`/reports/${citation.recordId}`}
                            className="inline-flex items-center gap-1.5 rounded border border-line bg-sunken px-2 py-0.5 text-xs text-ink-soft hover:border-primary-line hover:text-primary"
                          >
                            <FileText className="h-3 w-3" aria-hidden="true" />
                            {citation.fileName}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={answer.source === 'openai' ? 'primary' : 'neutral'}>
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                  {answer.source === 'openai' ? 'Reworded by a language model' : 'Deterministic explainer'}
                </Badge>
                <span className="text-xs text-muted">
                  grounded in {answer.groundedIn.analysedRecords} analysed report
                  {answer.groundedIn.analysedRecords === 1 ? '' : 's'}
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
        title="Health assistant"
        description="Ask about the values in your own reports. Answers are built from what the platform extracted — never from a value it did not read."
      />

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Panel className="flex min-w-0 min-h-[32rem] flex-col lg:col-span-2">
          <PanelHeader title="Conversation" icon={MessageSquareText} />

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {turns.length === 0 ? (
              <div className="py-8 text-center">
                <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-sunken">
                  <MessageSquareText className="h-5 w-5 text-faint" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold text-ink">Ask about your results</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                  Every answer is grounded in reports you have uploaded, and cites the report it came
                  from.
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => ask(suggestion)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-primary-line hover:bg-primary-soft hover:text-primary-ink"
                      >
                        <Sparkle className="h-3 w-3 text-faint" aria-hidden="true" />
                        {suggestion}
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

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
            className="border-t border-line p-4"
          >
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What is my HbA1c, and has it changed?"
                aria-label="Ask a question about your results"
                maxLength={500}
              />
              <Button type="submit" loading={busy} disabled={!question.trim()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Ask</span>
              </Button>
            </div>
            {turns.length > 0 && suggestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary-line hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </form>
        </Panel>

        <div className="min-w-0 space-y-5">
          <Boundaries />
          <MedicalDisclaimer text={disclaimer || undefined} />
        </div>
      </div>
    </AppShell>
  );
};

export default Assistant;
