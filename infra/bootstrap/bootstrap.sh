#!/usr/bin/env bash
# One time Google Cloud setup for Mini Philia. Human run only, from Cloud Shell, as the billing account owner.
# Safe to re-run: every step checks before it creates.
#
# Creates:
#   projects   <prefix>-platform-<sfx>, <prefix>-staging-<sfx>, <prefix>-production-<sfx>
#   platform   Artifact Registry (docker, cleanup policy), Terraform state buckets,
#              Workload Identity Federation pool for GitHub, budget topic and budget guard function
#   each env   APIs, deployer service account (keyless, bound to the GitHub environment), api runtime service account
#   billing    monthly budget excluding credits, alerts at 25/50/90/100 percent, Pub/Sub to the guard
#
# Creates nothing with an idle cost. Cloud SQL and Cloud Run come later, from Terraform in the deploy workflow.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
# shellcheck disable=SC1091
source "$HERE/config.env"

: "${BILLING_ACCOUNT_ID:?set in config.env}" "${GITHUB_OWNER:?set in config.env}" "${GITHUB_REPO:?set in config.env}"
: "${PROJECT_PREFIX:=sm-pilot}" "${REGION:=us-central1}" "${BUDGET_USD:=100}"
if [[ -z "${PROJECT_SUFFIX:-}" ]]; then
  PROJECT_SUFFIX="$(openssl rand -hex 2)"
  echo "PROJECT_SUFFIX=$PROJECT_SUFFIX" >>"$HERE/config.env"
  echo "Generated PROJECT_SUFFIX=$PROJECT_SUFFIX and saved it to config.env"
fi

PLATFORM="${PROJECT_PREFIX}-platform-${PROJECT_SUFFIX}"
ENVS=(staging production)
env_project() { echo "${PROJECT_PREFIX}-$1-${PROJECT_SUFFIX}"; }
REPO_FULL="${GITHUB_OWNER}/${GITHUB_REPO}"
AR_REPO=apps
POOL=github
PROVIDER=github-actions

log() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------- projects
create_project() {
  local id="$1"
  if gcloud projects describe "$id" >/dev/null 2>&1; then
    echo "project $id exists"
  else
    if [[ -n "${ORG_ID:-}" ]]; then
      gcloud projects create "$id" --organization="$ORG_ID" --labels=app=mini-philia
    else
      gcloud projects create "$id" --labels=app=mini-philia
    fi
  fi
  gcloud billing projects link "$id" --billing-account="$BILLING_ACCOUNT_ID" >/dev/null
}

log "Projects"
create_project "$PLATFORM"
for e in "${ENVS[@]}"; do create_project "$(env_project "$e")"; done

# ---------------------------------------------------------------- APIs
log "APIs (this takes a few minutes)"
gcloud services enable --project="$PLATFORM" \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com artifactregistry.googleapis.com storage.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com eventarc.googleapis.com \
  logging.googleapis.com billingbudgets.googleapis.com cloudbilling.googleapis.com sqladmin.googleapis.com
for e in "${ENVS[@]}"; do
  gcloud services enable --project="$(env_project "$e")" \
    iam.googleapis.com iamcredentials.googleapis.com cloudresourcemanager.googleapis.com serviceusage.googleapis.com \
    run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com storage.googleapis.com \
    aiplatform.googleapis.com logging.googleapis.com monitoring.googleapis.com
done

# ---------------------------------------------------------------- platform: registry and state
log "Artifact Registry"
if ! gcloud artifacts repositories describe "$AR_REPO" --project="$PLATFORM" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" --project="$PLATFORM" --location="$REGION" \
    --repository-format=docker --description="Mini Philia images, built once and promoted by digest"
fi
gcloud artifacts repositories set-cleanup-policies "$AR_REPO" --project="$PLATFORM" --location="$REGION" \
  --policy="$HERE/ar-cleanup-policy.json" --no-dry-run >/dev/null

log "Terraform state buckets"
for e in "${ENVS[@]}"; do
  b="gs://${PROJECT_PREFIX}-tfstate-${e}-${PROJECT_SUFFIX}"
  if ! gcloud storage buckets describe "$b" >/dev/null 2>&1; then
    gcloud storage buckets create "$b" --project="$PLATFORM" --location="$REGION" \
      --uniform-bucket-level-access --public-access-prevention
  fi
  gcloud storage buckets update "$b" --versioning >/dev/null
done

# ---------------------------------------------------------------- keyless CI
log "Workload Identity Federation for $REPO_FULL"
PLATFORM_NUMBER="$(gcloud projects describe "$PLATFORM" --format='value(projectNumber)')"
if ! gcloud iam workload-identity-pools describe "$POOL" --project="$PLATFORM" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project="$PLATFORM" --location=global --display-name="GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --project="$PLATFORM" --location=global \
     --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project="$PLATFORM" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${REPO_FULL}'"
fi
WIF_PROVIDER="projects/${PLATFORM_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

bind() { gcloud projects add-iam-policy-binding "$1" --member="$2" --role="$3" --condition=None >/dev/null; }

for e in "${ENVS[@]}"; do
  P="$(env_project "$e")"
  log "Service accounts in $P"
  for sa in deployer api-runtime; do
    gcloud iam service-accounts describe "${sa}@${P}.iam.gserviceaccount.com" --project="$P" >/dev/null 2>&1 ||
      gcloud iam service-accounts create "$sa" --project="$P" --display-name="$sa"
  done
  DEPLOYER="serviceAccount:deployer@${P}.iam.gserviceaccount.com"
  RUNTIME="serviceAccount:api-runtime@${P}.iam.gserviceaccount.com"

  # Deployer: enough for Terraform to manage Cloud Run, Cloud SQL, buckets and secrets. No IAM admin on the project.
  for role in roles/run.admin roles/cloudsql.admin roles/storage.admin roles/secretmanager.admin \
              roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer roles/iam.serviceAccountViewer; do
    bind "$P" "$DEPLOYER" "$role"
  done
  # Runtime: what the API needs at run time.
  for role in roles/cloudsql.client roles/cloudsql.instanceUser roles/aiplatform.user \
              roles/secretmanager.secretAccessor roles/logging.logWriter; do
    bind "$P" "$RUNTIME" "$role"
  done

  # Only jobs that run in the GitHub environment of the same name can become this deployer.
  gcloud iam service-accounts add-iam-policy-binding "deployer@${P}.iam.gserviceaccount.com" --project="$P" \
    --role=roles/iam.workloadIdentityUser \
    --member="principal://iam.googleapis.com/projects/${PLATFORM_NUMBER}/locations/global/workloadIdentityPools/${POOL}/subject/repo:${REPO_FULL}:environment:${e}" >/dev/null

  gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_PREFIX}-tfstate-${e}-${PROJECT_SUFFIX}" \
    --member="$DEPLOYER" --role=roles/storage.objectAdmin >/dev/null

  # Images: staging builds and pushes, production only reads. Cloud Run in each project pulls.
  if [[ "$e" == "staging" ]]; then ar_role=roles/artifactregistry.writer; else ar_role=roles/artifactregistry.reader; fi
  gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --project="$PLATFORM" --location="$REGION" \
    --member="$DEPLOYER" --role="$ar_role" >/dev/null
  gcloud beta services identity create --service=run.googleapis.com --project="$P" >/dev/null 2>&1 || true
  P_NUMBER="$(gcloud projects describe "$P" --format='value(projectNumber)')"
  gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --project="$PLATFORM" --location="$REGION" \
    --member="serviceAccount:service-${P_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com" \
    --role=roles/artifactregistry.reader >/dev/null
done

# ---------------------------------------------------------------- budget guard
log "Budget guard"
TOPIC=budget-alerts
gcloud pubsub topics describe "$TOPIC" --project="$PLATFORM" >/dev/null 2>&1 ||
  gcloud pubsub topics create "$TOPIC" --project="$PLATFORM"
for sa in budget-guard builder; do
  gcloud iam service-accounts describe "${sa}@${PLATFORM}.iam.gserviceaccount.com" --project="$PLATFORM" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$sa" --project="$PLATFORM" --display-name="$sa"
done
GUARD="serviceAccount:budget-guard@${PLATFORM}.iam.gserviceaccount.com"
BUILDER="serviceAccount:builder@${PLATFORM}.iam.gserviceaccount.com"
bind "$PLATFORM" "$BUILDER" roles/cloudbuild.builds.builder
bind "$PLATFORM" "$GUARD" roles/run.invoker
bind "$PLATFORM" "$GUARD" roles/eventarc.eventReceiver
TARGETS=()
for e in "${ENVS[@]}"; do
  P="$(env_project "$e")"; TARGETS+=("$P")
  for role in roles/cloudsql.editor roles/run.developer roles/iam.serviceAccountUser; do bind "$P" "$GUARD" "$role"; done
done

gcloud functions deploy budget-guard --project="$PLATFORM" --region="$REGION" --gen2 --runtime=nodejs22 \
  --source="$REPO_ROOT/infra/budget-guard" --entry-point=budgetGuard \
  --trigger-topic="$TOPIC" --service-account="budget-guard@${PLATFORM}.iam.gserviceaccount.com" \
  --trigger-service-account="budget-guard@${PLATFORM}.iam.gserviceaccount.com" \
  --build-service-account="projects/${PLATFORM}/serviceAccounts/builder@${PLATFORM}.iam.gserviceaccount.com" \
  --set-env-vars="TARGET_PROJECTS=$(IFS=,; echo "${TARGETS[*]}"),REGION=${REGION}" \
  --memory=256Mi --max-instances=1 --quiet

log "Budget"
gcloud config set project "$PLATFORM" >/dev/null
if gcloud billing budgets list --billing-project="$PLATFORM" --billing-account="$BILLING_ACCOUNT_ID" --format='value(displayName)' | grep -qx 'mini-philia-monthly'; then
  echo "budget exists"
else
  gcloud billing budgets create --billing-project="$PLATFORM" --billing-account="$BILLING_ACCOUNT_ID" --display-name=mini-philia-monthly \
    --budget-amount="${BUDGET_USD}USD" --calendar-period=month --credit-types-treatment=exclude-all-credits \
    --threshold-rule=percent=0.25 --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 --threshold-rule=percent=1.0,basis=forecasted-spend \
    --notifications-rule-pubsub-topic="projects/${PLATFORM}/topics/${TOPIC}"
fi

# ---------------------------------------------------------------- Studio budget feed (optional)
if [[ -n "${STUDIO_BUDGET_PUSH_URL:-}" ]]; then
  log "Studio budget push"
  PUSH_SA="budget-push@${PLATFORM}.iam.gserviceaccount.com"
  gcloud iam service-accounts describe "$PUSH_SA" --project="$PLATFORM" >/dev/null 2>&1 ||
    gcloud iam service-accounts create budget-push --project="$PLATFORM" --display-name="Signs budget pushes to Studio"
  # Pub/Sub mints the OIDC token on behalf of budget-push.
  gcloud iam service-accounts add-iam-policy-binding "$PUSH_SA" --project="$PLATFORM" \
    --member="serviceAccount:service-${PLATFORM_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
    --role=roles/iam.serviceAccountTokenCreator >/dev/null
  if gcloud pubsub subscriptions describe studio-budget-push --project="$PLATFORM" >/dev/null 2>&1; then
    gcloud pubsub subscriptions update studio-budget-push --project="$PLATFORM" \
      --push-endpoint="$STUDIO_BUDGET_PUSH_URL" --push-auth-service-account="$PUSH_SA" \
      --push-auth-token-audience="$STUDIO_BUDGET_PUSH_URL" >/dev/null
  else
    gcloud pubsub subscriptions create studio-budget-push --project="$PLATFORM" --topic="$TOPIC" \
      --push-endpoint="$STUDIO_BUDGET_PUSH_URL" --push-auth-service-account="$PUSH_SA" \
      --push-auth-token-audience="$STUDIO_BUDGET_PUSH_URL" --ack-deadline=30 --message-retention-duration=1d
  fi
  echo "Enter this push service account email in Studio Build > Settings: $PUSH_SA"
fi

# ---------------------------------------------------------------- outputs
OUT="$HERE/outputs.env"
{
  echo "# GitHub repository variables. Paste with scripts/github-setup.sh, or by hand under Settings > Secrets and variables > Actions > Variables."
  echo "GCP_REGION=$REGION"
  echo "GCP_PLATFORM_PROJECT=$PLATFORM"
  echo "GCP_WIF_PROVIDER=$WIF_PROVIDER"
  echo "GCP_AR_REPO=${REGION}-docker.pkg.dev/${PLATFORM}/${AR_REPO}"
  echo "# Environment variables (per GitHub environment)"
  for e in "${ENVS[@]}"; do
    P="$(env_project "$e")"
    echo "${e}.GCP_PROJECT=$P"
    echo "${e}.GCP_DEPLOYER_SA=deployer@${P}.iam.gserviceaccount.com"
    echo "${e}.GCP_RUNTIME_SA=api-runtime@${P}.iam.gserviceaccount.com"
    echo "${e}.TF_STATE_BUCKET=${PROJECT_PREFIX}-tfstate-${e}-${PROJECT_SUFFIX}"
  done
} >"$OUT"

log "Done. Values for GitHub are in $OUT"
cat "$OUT"
cat <<EOF

Next (see docs/setup.md):
  1. Vertex AI Model Garden: enable the Claude models in BOTH env projects (console, accept terms).
  2. Run scripts/github-setup.sh with $OUT to set the variables and environments.
EOF
