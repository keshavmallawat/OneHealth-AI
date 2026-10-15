import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  Plus,
  Trash2,
  Undo2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { remindersApi } from '../services/remindersApi';
import type { Reminder } from '../services/remindersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import { useToast } from '../context/ToastContext';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  PanelHeader,
  PageHeader,
  Skeleton,
  Textarea,
} from '../components/ui';

const Reminders: React.FC = () => {
  const toast = useToast();
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
      toast.success('Reminder Created', 'Scheduled medical follow-up added to your timeline');
      await load();
    } catch (err) {
      const msg = apiErrorMessage(err, 'The reminder could not be saved.');
      setError(msg);
      toast.error('Save Failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (reminder: Reminder) => {
    try {
      await remindersApi.setCompleted(reminder.id, !reminder.completed);
      if (!reminder.completed) {
        toast.success('Completed', `Marked "${reminder.title}" as complete`);
      } else {
        toast.info('Reopened', `Reopened "${reminder.title}"`);
      }
      await load();
    } catch (err) {
      const msg = apiErrorMessage(err, 'The reminder could not be updated.');
      setError(msg);
      toast.error('Update Failed', msg);
    }
  };

  const remove = async (reminder: Reminder) => {
    try {
      await remindersApi.remove(reminder.id);
      toast.info('Deleted', 'Reminder removed from your schedule');
      await load();
    } catch (err) {
      const msg = apiErrorMessage(err, 'The reminder could not be removed.');
      setError(msg);
      toast.error('Delete Failed', msg);
    }
  };

  const open = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <AppShell>
      {/* Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-teal-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl shadow-teal-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_20%,rgba(20,184,166,0.18),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-3">
              <Calendar className="h-3.5 w-3.5" />
              Follow-Up & Adherence Protocol
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Clinical Care Reminders
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Track recommended follow-up laboratory panels, fasting blood tests, prescription renewals, and upcoming specialist appointments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold">
              <Clock className="h-4 w-4 text-teal-400" />
              <span>{open.length} Pending Actions</span>
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        title="Diagnostic Follow-ups"
        description="Private reminders stored securely on your account. No SMS or unencrypted third-party notifications are dispatched."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Left Column: Reminders List */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <Panel>
            <PanelHeader
              title={`Active Follow-ups (${open.length})`}
              description="Tests, consultations, and screenings requiring action"
              icon={BellRing}
            />
            {loading ? (
              <div className="space-y-4 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : open.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="All caught up!"
                description="No outstanding diagnostic tests or scheduled appointments on your docket."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {open.map((reminder) => (
                  <li key={reminder.id} className="flex items-start gap-3.5 p-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <button
                      type="button"
                      onClick={() => toggle(reminder)}
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-transparent hover:text-teal-600 transition-all"
                      aria-label="Mark reminder completed"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {reminder.title}
                        </span>
                        {reminder.overdue && (
                          <Badge tone="danger" className="animate-pulse">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                      </div>

                      {reminder.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                          {reminder.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className={reminder.overdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}>
                          Due {formatDate(reminder.dueAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(reminder)}
                        aria-label={`Delete reminder: ${reminder.title}`}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {done.length > 0 && (
            <Panel>
              <PanelHeader
                title={`Completed History (${done.length})`}
                description="Past fulfilled tests and finished appointments"
                icon={CheckCircle2}
              />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {done.map((reminder) => (
                  <li key={reminder.id} className="flex items-center gap-3.5 p-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-through">
                        {reminder.title}
                      </p>
                      <p className="text-[11px] text-slate-400">Fulfilled · Target: {formatDate(reminder.dueAt)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggle(reminder)} className="text-xs text-slate-400 hover:text-slate-700">
                      <Undo2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Reopen
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* Right Column: New Reminder Form */}
        <Panel className="border-teal-200/60 dark:border-teal-900/40">
          <PanelHeader
            title="Schedule Follow-up"
            description="Add recurring or one-off test reminder"
            icon={Plus}
          />
          <form onSubmit={add} className="space-y-4 p-5 sm:p-6">
            <Field label="Medical Action / Test Name" htmlFor="reminder-title" required>
              <Input
                id="reminder-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fasting Lipid Profile repeat"
                required
                maxLength={120}
              />
            </Field>

            <Field label="Target Due Date" htmlFor="reminder-date" required>
              <Input
                id="reminder-date"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
            </Field>

            <Field label="Physician Clinical Notes" htmlFor="reminder-notes" hint="Optional rationale">
              <Textarea
                id="reminder-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Dr Menon requested a 3-month follow-up after starting statin therapy."
                maxLength={500}
              />
            </Field>

            <Button
              type="submit"
              loading={busy}
              disabled={!title.trim() || !dueAt}
              className="w-full justify-center shadow-md shadow-teal-500/20"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Follow-up Reminder
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
};

export default Reminders;
