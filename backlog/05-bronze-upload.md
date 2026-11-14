title: Bronze upload of donor CSV files with file hash lineage
labels: risk:R2,data:synthetic,agent-eligible
---
### Outcome
A signed in user uploads a donor or gift CSV and it is stored exactly as received, once, traceable by its hash.

### Acceptance criteria
- [ ] `POST /uploads` stores the raw file at `gs://<uploads>/<tenant_id>/<sha256>` with if-generation-match 0 (never overwrite).
- [ ] `bronze.file` row: tenant_id, sha256, size, original name, uploaded_by, uploaded_at. Re-uploading the same bytes returns the existing record.
- [ ] Size limit 10 MB and CSV content type check.
- [ ] Integration test with the synthetic fixtures; isolation test that tenant B cannot list tenant A files.
