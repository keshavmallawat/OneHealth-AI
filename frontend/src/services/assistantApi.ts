/** Health assistant endpoints. */
import api from './apiClient';

export interface AssistantAnswer {
  question: string;
  answer: string;
  kind: string;
  refused: boolean;
  source: 'deterministic' | 'openai';
  citations: { recordId: string | null; fileName: string | null; date: string | null }[];
  disclaimer: string;
  fallbackReason?: string;
  groundedIn: { records: number; analysedRecords: number; parameters: number };
}

export const assistantApi = {
  ask: (question: string) =>
    api.post('/assistant/ask', { question }).then((r) => r.data.data as AssistantAnswer),

  suggestions: () =>
    api.get('/assistant/suggestions').then((r) => r.data.data.suggestions as string[]),
};
