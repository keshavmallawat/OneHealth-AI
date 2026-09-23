/** In-app reminders. The platform sends nothing by email or SMS. */
import api from './apiClient';

export interface Reminder {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string;
  completed: boolean;
  completedAt: string | null;
  overdue: boolean;
  createdAt: string;
}

export const remindersApi = {
  list: () =>
    api.get('/reminders').then((r) => r.data.data as {
      reminders: Reminder[];
      counts: { open: number; overdue: number };
    }),

  create: (input: { title: string; notes?: string; dueAt: string }) =>
    api.post('/reminders', input).then((r) => r.data.data.reminder as Reminder),

  setCompleted: (id: string, completed: boolean) =>
    api.patch(`/reminders/${id}`, { completed }).then((r) => r.data.data.reminder as Reminder),

  remove: (id: string) => api.delete(`/reminders/${id}`).then((r) => r.data),
};
