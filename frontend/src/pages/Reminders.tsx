import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, Plus, Trash2, Undo2 } from 'lucide-react';
import { remindersApi } from '../services/remindersApi';
import type { Reminder } from '../services/remindersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Button, EmptyState, Field, Input, Panel, PanelHeader, PageHeader, Skeleton, Textarea,
} from '../components/ui';

const Reminders: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await remindersApi.list();
      setReminders(data.reminders);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your reminders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueAt) return;
    setBusy(true);
    setError('');
    try {
      await remindersApi.create({
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(),
      });
      setTitle('');
      setNotes('');
      setDueAt('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The reminder could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (reminder: Reminder) => {
    try {
      await remindersApi.setCompleted(reminder.id, !reminder.completed);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The reminder could not be updated.'));
    }
  };

  const remove = async (reminder: Reminder) => {
    try {
      await remindersApi.remove(reminder.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The reminder could not be removed.'));
    }
  };

  const open = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <AppShell>
      <PageHeader
        title="Reminders"
        description="Notes to yourself about follow-up tests and appointments. These are shown inside OneHealth only — no email or SMS is sent."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2 space-y-5">
          <Panel>
            <PanelHeader title={`Open (${open.length})`} icon={BellRing} />
            {loading ? (
              <div className="space-y-3 px-5 py-5">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : open.length === 0 ? (
              <EmptyState
                compact
                icon={BellRing}
                title="Nothing due"
                description="Add a reminder when a clinician asks you to repeat a test."
              />
            ) : (
              <ul className="divide-y divide-line">
                {open.map((reminder) => (
                  <li key={reminder.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{reminder.title}</p>
                      {reminder.notes && (
                        <p className="mt-0.5 text-xs text-muted">{reminder.notes}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`text-xs ${reminder.overdue ? 'text-high' : 'text-muted'}`}>
                          Due {formatDate(reminder.dueAt)}
                        </span>
                        {reminder.overdue && <Badge tone="danger">Overdue</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => toggle(reminder)}>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(reminder)}
                        aria-label={`Delete reminder: ${reminder.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {done.length > 0 && (
            <Panel>
              <PanelHeader title={`Completed (${done.length})`} />
              <ul className="divide-y divide-line">
                {done.map((reminder) => (
                  <li key={reminder.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted line-through">{reminder.title}</p>
                      <p className="text-xs text-faint">Due {formatDate(reminder.dueAt)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggle(reminder)}>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Reopen
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel>
          <PanelHeader title="New reminder" icon={Plus} />
          <form onSubmit={add} className="space-y-4 p-5">
            <Field label="What is it?" htmlFor="reminder-title" required>
              <Input
                id="reminder-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Repeat fasting glucose"
                required
                maxLength={120}
              />
            </Field>
            <Field label="Due date" htmlFor="reminder-date" required>
              <Input
                id="reminder-date"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
            </Field>
            <Field label="Notes" htmlFor="reminder-notes" hint="Optional">
              <Textarea
                id="reminder-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dr Menon asked for a repeat in three months."
                maxLength={500}
              />
            </Field>
            <Button type="submit" loading={busy} disabled={!title.trim() || !dueAt} className="w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add reminder
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
};

export default Reminders;
