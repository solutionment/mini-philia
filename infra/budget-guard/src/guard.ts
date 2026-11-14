// Pure decision and action logic for the budget guard. No Google libraries here, so it is easy to test.

export interface BudgetNotification {
  budgetDisplayName?: string;
  costAmount: number;
  budgetAmount: number;
  alertThresholdExceeded?: number;
  forecastThresholdExceeded?: number;
  currencyCode?: string;
}

export type Requester = (req: { method: 'GET' | 'PATCH'; url: string; body?: unknown }) => Promise<any>;

export function parseNotification(base64Data: string | undefined): BudgetNotification | null {
  if (!base64Data) return null;
  try {
    const parsed = JSON.parse(Buffer.from(base64Data, 'base64').toString('utf8'));
    if (typeof parsed.costAmount !== 'number' || typeof parsed.budgetAmount !== 'number') return null;
    return parsed as BudgetNotification;
  } catch {
    return null;
  }
}

// Act only on actual spend at or over the budget. Forecast alerts only email.
export function shouldShutDown(n: BudgetNotification): boolean {
  return n.budgetAmount > 0 && n.costAmount >= n.budgetAmount;
}

export async function shutDown(projects: string[], region: string, request: Requester): Promise<string[]> {
  const actions: string[] = [];
  for (const project of projects) {
    const sql = await request({
      method: 'GET',
      url: `https://sqladmin.googleapis.com/v1/projects/${project}/instances`,
    });
    for (const inst of sql?.items ?? []) {
      if (inst?.settings?.activationPolicy === 'NEVER') continue;
      await request({
        method: 'PATCH',
        url: `https://sqladmin.googleapis.com/v1/projects/${project}/instances/${inst.name}`,
        body: { settings: { activationPolicy: 'NEVER' } },
      });
      actions.push(`stopped sql ${project}/${inst.name}`);
    }

    const run = await request({
      method: 'GET',
      url: `https://run.googleapis.com/v2/projects/${project}/locations/${region}/services`,
    });
    for (const svc of run?.services ?? []) {
      if (svc?.ingress === 'INGRESS_TRAFFIC_INTERNAL_ONLY') continue;
      await request({
        method: 'PATCH',
        url: `https://run.googleapis.com/v2/${svc.name}?updateMask=ingress`,
        body: { ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY' },
      });
      actions.push(`closed run ${svc.name}`);
    }
  }
  return actions;
}
