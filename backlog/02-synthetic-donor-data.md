title: Synthetic donor CSV generator with flaw injectors
labels: risk:R1,data:synthetic,agent-eligible
---
### Outcome
The team can generate realistic, fake donor and gift CSV files for two tenants, with known data quality flaws, so every later stage is tested without real data.

### Acceptance criteria
- [ ] `synthetic/` has a TypeScript generator with a fixed seed: `npm run synthetic -- --tenant acme --donors 500` writes donors.csv and gifts.csv.
- [ ] Flaw injectors, each toggled by flag and counted in a sidecar manifest: duplicate donors with name variants, bad emails, missing postcodes, future gift dates, negative amounts, mixed date formats.
- [ ] Names and emails are obviously fake (reserved domains such as example.org).
- [ ] Two fixtures committed for tenants `acme` and `globex`, 200 donors each, with their manifests.
- [ ] Tests prove the same seed gives byte identical output.
