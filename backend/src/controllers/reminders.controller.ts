/**
 * Reminders — a small, real feature rather than a decorative one.
 *
 * Reminders are stored, listed, completed and deleted against the signed-in
 * patient. There is no notification delivery: the platform does not send email
 * or SMS, so the UI describes them as in-app reminders and nothing claims
 * otherwise.
 */
import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { fail, guard, ok, zodMessage } from '../lib/http';

const createSchema = z.object({
  title: z.string().trim().min(2, 'Give the reminder a title').max(120),
  notes: z.string().trim().max(500).optional().nullable(),
  dueAt: z.string().min(4, 'Choose a date'),
});

function shape(reminder: any) {
  return {
    id: reminder.id,
    title: reminder.title,
    notes: reminder.notes,
    dueAt: reminder.dueAt,
    completed: reminder.completed,
    completedAt: reminder.completedAt,
    overdue: !reminder.completed && reminder.dueAt.getTime() < Date.now(),
    createdAt: reminder.createdAt,
  };
}

export class RemindersController {
  static list = guard(async (req: any, res: Response) => {
    const reminders = await prisma.reminder.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ completed: 'asc' }, { dueAt: 'asc' }],
      take: 50,
    });
    const shaped = reminders.map(shape);
    return ok(res, {
      reminders: shaped,
      counts: {
        open: shaped.filter((r) => !r.completed).length,
        overdue: shaped.filter((r) => r.overdue).length,
      },
    });
  }, 'Failed to load your reminders.');

  static create = guard(async (req: any, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const dueAt = new Date(parsed.data.dueAt);
    if (Number.isNaN(dueAt.getTime())) return fail(res, 400, 'That date is not valid.');

    const reminder = await prisma.reminder.create({
      data: {
        userId: req.user.userId,
        title: parsed.data.title,
        notes: parsed.data.notes || null,
        dueAt,
      },
    });
    return ok(res, { reminder: shape(reminder) }, 'Reminder added.', 201);
  }, 'Failed to add that reminder.');

  static update = guard(async (req: any, res: Response) => {
    const schema = z.object({ completed: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.userId !== req.user.userId) {
      return fail(res, 404, 'That reminder could not be found.');
    }

    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        completed: parsed.data.completed,
        completedAt: parsed.data.completed ? new Date() : null,
      },
    });
    return ok(res, { reminder: shape(reminder) }, parsed.data.completed ? 'Marked as done.' : 'Reopened.');
  }, 'Failed to update that reminder.');

  static remove = guard(async (req: any, res: Response) => {
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.userId !== req.user.userId) {
      return fail(res, 404, 'That reminder could not be found.');
    }
    await prisma.reminder.delete({ where: { id: existing.id } });
    return ok(res, null, 'Reminder removed.');
  }, 'Failed to remove that reminder.');
}
