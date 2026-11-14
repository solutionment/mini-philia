import * as ff from '@google-cloud/functions-framework';
import { GoogleAuth } from 'google-auth-library';
import { parseNotification, shouldShutDown, shutDown } from './guard.js';

interface PubSubData {
  message?: { data?: string };
}

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

ff.cloudEvent<PubSubData>('budgetGuard', async (event: ff.CloudEvent<PubSubData>) => {
  const n = parseNotification(event.data?.message?.data);
  if (!n) {
    console.warn('budget-guard: ignored message without cost data');
    return;
  }
  console.log(`budget-guard: cost ${n.costAmount} of ${n.budgetAmount} ${n.currencyCode ?? ''}`);
  if (!shouldShutDown(n)) return;

  const projects = (process.env.TARGET_PROJECTS ?? '').split(',').filter(Boolean);
  const region = process.env.REGION ?? 'us-central1';
  const client = await auth.getClient();
  const actions = await shutDown(projects, region, async ({ method, url, body }) => {
    const res = await client.request({ method, url, data: body });
    return res.data;
  });
  console.log(`budget-guard: budget reached, actions: ${actions.join('; ') || 'nothing left to stop'}`);
});
