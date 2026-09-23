/**
 * Client for the Python AI service (OCR + medical extraction + summary).
 *
 * Design rules:
 *  - The backend NEVER invents medical content. Everything here comes from the
 *    AI service response; this module only validates and normalises it.
 *  - The medical disclaimer is applied here, server-side, so it cannot be lost
 *    even if the AI service response were ever missing it.
 *  - A failure of the AI service must never lose the patient's uploaded file.
 *    Callers mark the record FAILED and can retry; the document is untouched.
 */
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

/** Applied server-side to every AI-generated summary. Single source of truth. */
export const AI_DISCLAIMER =
  'AI-generated information is for informational purposes only and does not ' +
  'constitute medical diagnosis or treatment. Please consult a qualified ' +
  'healthcare professional for interpretation of your results.';

export type ParameterStatus = 'NORMAL' | 'LOW' | 'HIGH' | 'UNKNOWN';

export interface ExtractedParameter {
  key: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceBasis?: string;
  referenceSource?: string;
  reportedRange?: string | null;
  reportedUnit?: string | null;
  status: ParameterStatus;
  confidence: number;
  panel: string;
  sourceLine?: string;
  patientLabel?: string;
}

export interface AiAnalysis {
  parameters: ExtractedParameter[];
  ocrText: string;
  summary: string;
  summarySource: string;
  disclaimer: string;
  fallbackReason?: string;
  extraction: {
    source: string;
    pages: number;
    characters: number;
    warnings: string[];
    ocrAvailable: boolean;
  };
  stats: {
    parameterCount: number;
    abnormalCount: number;
    normalCount: number;
    unknownCount: number;
  };
  detectedSex: string | null;
  processingMs: number;
}


export interface AssistantContext {
  recordCount: number;
  analysedCount: number;
  latest: {
    id: string;
    fileName: string;
    date: string | null;
    dateLabel: string | null;
    parameters: {
      key: string;
      testName: string;
      value: number;
      unit: string;
      referenceRange: string;
      status: string;
    }[];
  } | null;
  history: {
    key: string;
    testName: string;
    value: number;
    unit: string;
    referenceRange: string;
    status: string;
    recordId: string;
    fileName: string;
    date: string;
    dateLabel: string;
  }[];
}

export interface AssistantAnswer {
  answer: string;
  kind: string;
  refused: boolean;
  source: string;
  citations: { recordId: string | null; fileName: string | null; date: string | null }[];
  disclaimer: string;
  fallbackReason?: string;
}

export interface AiHealth {
  reachable: boolean;
  status?: string;
  version?: string;
  capabilities?: Record<string, unknown>;
  error?: string;
}

const client = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: env.AI_SERVICE_TIMEOUT_MS,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

/** Turn any axios/network failure into a message worth showing a user. */
function describeFailure(error: unknown): string {
  const axiosError = error as AxiosError<any>;
  if (axiosError?.code === 'ECONNREFUSED' || axiosError?.code === 'ERR_BAD_REQUEST' && !axiosError.response) {
    return 'The AI service is not running. Start it with: cd ai-service && uvicorn app.main:app --port 8001';
  }
  if (axiosError?.code === 'ECONNABORTED') {
    return 'The AI service took too long to respond. Try again, or upload a smaller document.';
  }
  const detail = axiosError?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (axiosError?.response?.status) {
    return `The AI service returned an error (HTTP ${axiosError.response.status}).`;
  }
  if (axiosError?.message?.includes('ECONNREFUSED')) {
    return 'The AI service is not running. Start it with: cd ai-service && uvicorn app.main:app --port 8001';
  }
  return axiosError?.message || 'The AI service could not be reached.';
}

export class AiService {
  /** Is the AI service up, and what can it do right now? */
  static async health(): Promise<AiHealth> {
    try {
      const { data } = await client.get('/health', { timeout: 4000 });
      return {
        reachable: true,
        status: data?.status,
        version: data?.version,
        capabilities: data?.capabilities,
      };
    } catch (error) {
      return { reachable: false, error: describeFailure(error) };
    }
  }

  /**
   * Send a document through the full pipeline.
   * Throws with a user-presentable message when the service is down or the
   * document cannot be read.
   */
  static async analyzeDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<AiAnalysis> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' }),
      filename || 'report'
    );
    form.append('includeText', 'true');

    let data: any;
    try {
      const response = await client.post('/api/analyze', form);
      data = response.data;
    } catch (error) {
      throw new Error(describeFailure(error));
    }

    if (!data || data.success !== true) {
      throw new Error('The AI service returned an unexpected response.');
    }

    const parameters: ExtractedParameter[] = Array.isArray(data.parameters)
      ? data.parameters
      : [];

    // Recompute the counts locally rather than trusting the payload.
    const abnormalCount = parameters.filter(
      (p) => p.status === 'LOW' || p.status === 'HIGH'
    ).length;

    return {
      parameters,
      ocrText: typeof data.ocrText === 'string' ? data.ocrText : '',
      summary: data?.summary?.text || '',
      summarySource: data?.summary?.source || 'unknown',
      // Server-side disclaimer: authoritative, never taken from the AI response.
      disclaimer: AI_DISCLAIMER,
      fallbackReason: data?.summary?.fallbackReason,
      extraction: {
        source: data?.extraction?.source || 'unknown',
        pages: data?.extraction?.pages ?? 0,
        characters: data?.extraction?.characters ?? 0,
        warnings: Array.isArray(data?.extraction?.warnings) ? data.extraction.warnings : [],
        ocrAvailable: Boolean(data?.extraction?.ocrAvailable),
      },
      stats: {
        parameterCount: parameters.length,
        abnormalCount,
        normalCount: parameters.filter((p) => p.status === 'NORMAL').length,
        unknownCount: parameters.filter((p) => p.status === 'UNKNOWN').length,
      },
      detectedSex: data?.detectedSex ?? null,
      processingMs: data?.processingMs ?? 0,
    };
  }
  /**
   * Ask the assistant a question about ONE patient's own results.
   *
   * The context is assembled by the caller from that patient's rows and is the
   * only material the AI service sees — it has no database access of its own,
   * so there is no path by which another patient's data could be reached.
   */
  static async ask(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    let data: any;
    try {
      const response = await client.post('/api/assistant', { question, context }, { timeout: 30000 });
      data = response.data;
    } catch (error) {
      throw new Error(describeFailure(error));
    }

    if (!data || data.success !== true || typeof data.answer !== 'string') {
      throw new Error('The AI service returned an unexpected response.');
    }

    return {
      answer: data.answer,
      kind: data.kind || 'UNMATCHED',
      refused: Boolean(data.refused),
      source: data.source === 'openai' ? 'openai' : 'deterministic',
      citations: Array.isArray(data.citations) ? data.citations : [],
      disclaimer: data.disclaimer || AI_DISCLAIMER,
      fallbackReason: data.fallbackReason,
    };
  }
}
