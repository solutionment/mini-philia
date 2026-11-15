// Collects per-environment stats from Google Cloud with read only calls. No Google libraries here,
// so the logic is testable with a fake requester. Every metric is best effort: a failing call yields null.

export type Requester = (url: string) => Promise<any>;

export interface EnvTarget { environment: 'staging' | 'production'; project: string }

export interface EnvStats {
  environment: string;
  project: string;
  service: null | {
    name: string; url: string | null; latest_revision: string | null; image: string | null; ready: boolean;
    last_deployed_at: string | null; min_instances: number | null; max_instances: number | null;
    requests_24h: number | null; errors_5xx_24h: number | null; latency_p95_ms: number | null; instances_now: number | null;
  };
  database: null | {
    name: string; state: string | null; tier: string | null; version: string | null; activation: string | null;
    disk_bytes_used: number | null; disk_bytes_total: number | null; cpu_util_pct: number | null;
  };
  storage: { bucket: string; total_bytes: number | null; object_count: number | null };
  ai: { tokens_24h: number | null };
}

// Naming conventions from infra/terraform.
export const names = (t: EnvTarget) => ({
  service: 'api',
  sqlInstance: `mini-philia-${t.environment}`,
  bucket: `${t.project}-uploads`,
});

/** First point of the first series in a Monitoring timeSeries.list response, as a number. */
export function scalar(resp: any): number | null {
  const v = resp?.timeSeries?.[0]?.points?.[0]?.value;
  if (!v) return null;
  const raw = v.int64Value ?? v.doubleValue;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export interface MetricQuery { filter: string; windowSeconds: number; alignmentSeconds: number; aligner: string; reducer: string }

export function monitoringUrl(project: string, q: MetricQuery, now: Date): string {
  const end = now.toISOString();
  const start = new Date(now.getTime() - q.windowSeconds * 1000).toISOString();
  const p = new URLSearchParams({
    filter: q.filter,
    'interval.startTime': start,
    'interval.endTime': end,
    'aggregation.alignmentPeriod': `${q.alignmentSeconds}s`,
    'aggregation.perSeriesAligner': q.aligner,
    'aggregation.crossSeriesReducer': q.reducer,
  });
  return `https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${p.toString()}`;
}

const DAY = 86400;

export function metricQueries(t: EnvTarget) {
  const n = names(t);
  const run = `resource.type="cloud_run_revision" AND resource.labels.service_name="${n.service}"`;
  const sql = `resource.type="cloudsql_database" AND resource.labels.database_id="${t.project}:${n.sqlInstance}"`;
  const gcs = `resource.type="gcs_bucket" AND resource.labels.bucket_name="${n.bucket}"`;
  return {
    requests: { filter: `metric.type="run.googleapis.com/request_count" AND ${run}`, windowSeconds: DAY, alignmentSeconds: DAY, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM' },
    errors: { filter: `metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx" AND ${run}`, windowSeconds: DAY, alignmentSeconds: DAY, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM' },
    latencyP95: { filter: `metric.type="run.googleapis.com/request_latencies" AND ${run}`, windowSeconds: DAY, alignmentSeconds: DAY, aligner: 'ALIGN_PERCENTILE_95', reducer: 'REDUCE_MAX' },
    instances: { filter: `metric.type="run.googleapis.com/container/instance_count" AND ${run}`, windowSeconds: 600, alignmentSeconds: 600, aligner: 'ALIGN_MAX', reducer: 'REDUCE_SUM' },
    diskUsed: { filter: `metric.type="cloudsql.googleapis.com/database/disk/bytes_used" AND ${sql}`, windowSeconds: 1800, alignmentSeconds: 1800, aligner: 'ALIGN_MEAN', reducer: 'REDUCE_MEAN' },
    cpu: { filter: `metric.type="cloudsql.googleapis.com/database/cpu/utilization" AND ${sql}`, windowSeconds: 1800, alignmentSeconds: 1800, aligner: 'ALIGN_MEAN', reducer: 'REDUCE_MEAN' },
    storageBytes: { filter: `metric.type="storage.googleapis.com/storage/v2/total_bytes" AND ${gcs}`, windowSeconds: 2 * DAY, alignmentSeconds: 2 * DAY, aligner: 'ALIGN_MEAN', reducer: 'REDUCE_SUM' },
    storageObjects: { filter: `metric.type="storage.googleapis.com/storage/v2/total_count" AND ${gcs}`, windowSeconds: 2 * DAY, alignmentSeconds: 2 * DAY, aligner: 'ALIGN_MEAN', reducer: 'REDUCE_SUM' },
    aiTokens: { filter: `metric.type="aiplatform.googleapis.com/publisher/online_serving/token_count"`, windowSeconds: DAY, alignmentSeconds: DAY, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM' },
  } satisfies Record<string, MetricQuery>;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

const lastSegment = (s: unknown) => (typeof s === 'string' && s ? s.split('/').pop() ?? null : null);
const round = (n: number | null, digits = 0) => (n === null ? null : Number(n.toFixed(digits)));
/** Google returns RFC 3339 times with up to nanoseconds; Studio expects standard ISO 8601 (milliseconds). */
export const isoTime = (s: unknown): string | null => {
  if (typeof s !== 'string' || !s) return null;
  const d = new Date(s.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function collectEnvironment(t: EnvTarget, region: string, request: Requester, now = new Date()): Promise<EnvStats> {
  const n = names(t);
  const q = metricQueries(t);
  const metric = (m: MetricQuery) => safe(async () => scalar(await request(monitoringUrl(t.project, m, now))));

  const [svc, sql, requests, errors, p95, instances, diskUsed, cpu, bytes, objects, tokens] = await Promise.all([
    safe(() => request(`https://run.googleapis.com/v2/projects/${t.project}/locations/${region}/services/${n.service}`)),
    safe(() => request(`https://sqladmin.googleapis.com/v1/projects/${t.project}/instances/${n.sqlInstance}`)),
    metric(q.requests), metric(q.errors), metric(q.latencyP95), metric(q.instances),
    metric(q.diskUsed), metric(q.cpu), metric(q.storageBytes), metric(q.storageObjects), metric(q.aiTokens),
  ]);

  const service = svc && svc.name ? {
    name: n.service,
    url: typeof svc.uri === 'string' ? svc.uri : null,
    latest_revision: lastSegment(svc.latestReadyRevision),
    image: svc.template?.containers?.[0]?.image ?? null,
    ready: svc.terminalCondition?.state === 'CONDITION_SUCCEEDED',
    last_deployed_at: isoTime(svc.updateTime),
    min_instances: svc.template?.scaling?.minInstanceCount ?? 0,
    max_instances: svc.template?.scaling?.maxInstanceCount ?? null,
    requests_24h: requests ?? 0,
    errors_5xx_24h: errors ?? 0,
    latency_p95_ms: round(p95, 1),
    instances_now: instances ?? 0,
  } : null;

  const diskGb = Number(sql?.settings?.dataDiskSizeGb);
  const database = sql && sql.name ? {
    name: n.sqlInstance,
    state: sql.state ?? null,
    tier: sql.settings?.tier ?? null,
    version: sql.databaseVersion ?? null,
    activation: sql.settings?.activationPolicy ?? null,
    disk_bytes_used: diskUsed === null ? null : Math.round(diskUsed),
    disk_bytes_total: Number.isFinite(diskGb) && diskGb > 0 ? diskGb * 1024 ** 3 : null,
    cpu_util_pct: cpu === null ? null : round(cpu * 100, 1),
  } : null;

  return {
    environment: t.environment,
    project: t.project,
    service,
    database,
    storage: { bucket: n.bucket, total_bytes: bytes === null ? null : Math.round(bytes), object_count: objects === null ? null : Math.round(objects) },
    ai: { tokens_24h: tokens },
  };
}

/** Parses "staging:proj-a,production:proj-b". */
export function parseTargets(spec: string): EnvTarget[] {
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [environment, project] = pair.split(':');
    if ((environment !== 'staging' && environment !== 'production') || !project) throw new Error(`bad target: ${pair}`);
    return { environment, project };
  });
}
