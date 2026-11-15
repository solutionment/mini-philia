import * as ff from '@google-cloud/functions-framework';
import { GoogleAuth } from 'google-auth-library';
import { collectEnvironment, parseTargets } from './collect.js';

// Called by Cloud Scheduler every 15 minutes (OIDC, private function). Reads stats for each environment
// with this function's read only service account, then pushes them to SolutionIQ Studio signed with a
// Google OIDC token whose audience is the Studio URL. Studio verifies the token and the account email.

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function idToken(audience: string): Promise<string> {
  const res = await fetch(
    `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`,
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  if (!res.ok) throw new Error(`identity token: ${res.status}`);
  return res.text();
}

ff.http('reportStats', async (_req, res) => {
  const pushUrl = process.env.STUDIO_STATS_PUSH_URL ?? '';
  const region = process.env.REGION ?? 'us-central1';
  try {
    const targets = parseTargets(process.env.ENV_PROJECTS ?? '');
    const client = await auth.getClient();
    const request = async (url: string) => (await client.request({ url })).data;
    const environments = await Promise.all(targets.map((t) => collectEnvironment(t, region, request)));
    const body = { v: 1, collected_at: new Date().toISOString(), environments };
    if (!pushUrl) {
      console.log(JSON.stringify({ severity: 'INFO', message: 'no STUDIO_STATS_PUSH_URL, stats not pushed', body }));
      res.status(200).send('collected, not pushed');
      return;
    }
    const push = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await idToken(pushUrl)}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    console.log(JSON.stringify({ severity: push.ok ? 'INFO' : 'WARNING', message: `pushed to Studio: ${push.status}` }));
    res.status(push.ok ? 200 : 502).send(`studio ${push.status}`);
  } catch (e) {
    console.error(JSON.stringify({ severity: 'ERROR', message: `env-reporter failed: ${(e as Error).message}` }));
    res.status(500).send('failed');
  }
});
