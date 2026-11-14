#!/usr/bin/env bash
# Undo what the budget guard did: start Cloud SQL again and reopen Cloud Run to public traffic.
# Human run only, after raising the budget or at the start of a new month.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/config.env"
: "${REGION:=us-central1}"
for e in staging production; do
  P="${PROJECT_PREFIX}-${e}-${PROJECT_SUFFIX}"
  for i in $(gcloud sql instances list --project="$P" --format='value(name)'); do
    echo "starting Cloud SQL $P/$i"
    gcloud sql instances patch "$i" --project="$P" --activation-policy=ALWAYS --quiet
  done
  for s in $(gcloud run services list --project="$P" --region="$REGION" --format='value(metadata.name)'); do
    echo "reopening Cloud Run $P/$s"
    gcloud run services update "$s" --project="$P" --region="$REGION" --ingress=all --quiet
  done
done
