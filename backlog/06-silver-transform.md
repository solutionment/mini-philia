title: Silver transform with logged, reversible changes
labels: risk:R2,data:synthetic,agent-eligible
---
### Outcome
Uploaded files become clean donor and gift records, and every change made on the way is logged and can be undone.

### Acceptance criteria
- [ ] Worker (Cloud Run job, scale to zero) parses a bronze file into `silver.donor` and `silver.gift`, each row keeping the source file hash and row number.
- [ ] Cleaning rules (trim, email normalise, date parse, amount sign) write `silver.change_log` entries with before and after values.
- [ ] Rejected rows go to `silver.reject` with a reason. The flaw manifest from the synthetic generator matches what was caught.
- [ ] A revert command restores a record from the change log. Tests prove it.
- [ ] No identity merging. Possible duplicates are flagged only.
