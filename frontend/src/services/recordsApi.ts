/** Health-record endpoints. */
import api from './apiClient';
import type { ParameterStatus, RecordStatus } from '../lib/format';

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

export interface RecordSummary {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  status: RecordStatus;
  tags: string[];
  reportDate: string | null;
  labName: string | null;
  notes: string | null;
  summarySource: string | null;
  abnormalCount: number;
  parameterCount: number;
  processingError: string | null;
  processedAt: string | null;
  uploadedAt: string;
}

export interface RecordDetail extends RecordSummary {
  aiSummary: string | null;
  parameters: ExtractedParameter[];
  extraction: {
    source: string;
    pages: number;
    characters: number;
    warnings: string[];
    ocrAvailable: boolean;
  } | null;
  detectedSex: string | null;
  fallbackReason: string | null;
  storageDriver: string;
  hasOcrText: boolean;
}

export interface TrendObservation {
  direction: 'INCREASED' | 'DECREASED' | 'STABLE' | 'SINGLE';
  delta: number;
  deltaPercent: number | null;
  note: string;
  newlyAbnormal: boolean;
  returnedToRange: boolean;
}

export interface ComparisonRow {
  key: string;
  testName: string;
  unit: string;
  panel: string;
  referenceRange: string;
  earlier: { value: number; status: ParameterStatus } | null;
  later: { value: number; status: ParameterStatus } | null;
  delta: number | null;
  deltaPercent: number | null;
  direction: 'INCREASED' | 'DECREASED' | 'STABLE' | 'SINGLE' | 'ADDED' | 'REMOVED';
  newlyAbnormal: boolean;
  returnedToRange: boolean;
}

export interface Comparison {
  earlier: { id: string; fileName: string; date: string; abnormalCount: number; parameterCount: number };
  later: { id: string; fileName: string; date: string; abnormalCount: number; parameterCount: number };
  rows: ComparisonRow[];
  summary: { improved: number; worsened: number; unchanged: number; added: number; removed: number };
}

export interface HealthStats {
  totalReports: number;
  analysedReports: number;
  processingReports: number;
  failedReports: number;
  parametersTracked: number;
  lastUploadAt: string | null;
  pendingConsents: number;
  activeConsents: number;
  openReminders: number;
  latestReport: {
    id: string;
    fileName: string;
    uploadedAt: string;
    reportDate: string | null;
    parameterCount: number;
    abnormalCount: number;
    normalCount: number;
    flagged: {
      key: string;
      testName: string;
      value: number;
      unit: string;
      status: ParameterStatus;
      referenceRange: string;
    }[];
  } | null;
}

export interface TrendSeries {
  key: string;
  testName: string;
  unit: string;
  panel: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceRange: string;
  points: { recordId: string; fileName: string; date: string; value: number; status: ParameterStatus }[];
  observation: TrendObservation;
}

export interface ActivityEntry {
  id: string;
  action: string;
  detail: string | null;
  timestamp: string;
  recordId: string | null;
  fileName: string | null;
  recordDeleted: boolean;
  /** False when someone else — a clinician — acted on this patient's data. */
  byMe: boolean;
  actor: { name: string; role: string };
}

export const recordsApi = {
  /** scope 'all' includes clinician access to this patient's data. */
  activity: (limit = 15, scope: 'all' | 'mine' = 'all') =>
    api.get('/records/activity', { params: { limit, scope } }).then(
      (r) => r.data.data.activity as ActivityEntry[]
    ),

  list: (
    params: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
      status?: string;
      tag?: string;
      from?: string;
      to?: string;
      sort?: 'newest' | 'oldest' | 'name' | 'flagged';
    } = {}
  ) =>
    api.get('/records', { params }).then((r) => r.data.data as {
      records: RecordSummary[];
      total: number;
      page: number;
      totalPages: number;
      availableTags: string[];
    }),

  get: (id: string) =>
    api.get(`/records/${id}`).then((r) => r.data.data as {
      record: RecordDetail;
      accessUrl: string | null;
      disclaimer: string;
    }),

  stats: () => api.get('/records/stats').then((r) => r.data.data as HealthStats),

  trends: () =>
    api.get('/records/trends').then((r) => r.data.data as {
      trends: TrendSeries[];
      reportsAnalysed: number;
      parametersWithOneReading: number;
      message?: string;
    }),

  compare: (a: string, b: string) =>
    api.get('/records/compare', { params: { a, b } }).then((r) => r.data.data as Comparison),

  update: (
    id: string,
    data: { type?: string; tags?: string[]; labName?: string | null; notes?: string | null; reportDate?: string | null }
  ) => api.patch(`/records/${id}`, data).then((r) => r.data.data.record as RecordSummary),

  /** Downloads the health summary PDF, keeping the Authorization header. */
  downloadSummary: async () => {
    const response = await api.get('/records/summary.pdf', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'OneHealth-Health-Summary.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  upload: (
    file: File,
    type: string,
    tags: string,
    onProgress?: (percent: number) => void,
    extra: { labName?: string; reportDate?: string } = {}
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (tags) form.append('tags', tags);
    if (extra.labName) form.append('labName', extra.labName);
    if (extra.reportDate) form.append('reportDate', extra.reportDate);
    return api
      .post('/records/upload', form, {
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      })
      .then((r) => r.data.data as { record: RecordSummary });
  },

  reprocess: (id: string) => api.post(`/records/${id}/reprocess`).then((r) => r.data),

  remove: (id: string) => api.delete(`/records/${id}`).then((r) => r.data),

  /** Fetches the original document as a blob URL, keeping the auth header. */
  fileBlobUrl: async (id: string) => {
    const response = await api.get(`/records/${id}/file`, { responseType: 'blob' });
    return URL.createObjectURL(response.data as Blob);
  },
};

export const systemApi = {
  health: () => api.get('/health').then((r) => r.data),
};
