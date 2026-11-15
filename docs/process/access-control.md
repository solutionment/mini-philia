# Who can do what

Solutionment provides and pays for the engineering resources (GitHub, the Claude agent team, Google Cloud). Solutionment staff therefore control everything that starts work, spends resources or changes what clients run. Clients and other guests see everything about their product and can ask for work.

**Solutionment staff** means a person signed in with a verified `@solutionment.com` account.

| Action | Solutionment staff | Clients and guests |
|---|---|---|
| See the board, live agent activity, pipeline, environments, insights and releases in Studio | Yes | Yes, for their products |
| Read delivery reports, release reports and the user guide | Yes | Yes |
| Create work items, send features or requirements to Build (they land in Backlog) | Yes | Yes |
| Edit product definitions (personas, use cases, features, requirements) | Yes, by product role | Yes, by product role |
| Mark a work item agent eligible | Yes | No |
| Start agents, approve plans, cancel runs, pause agents | Yes, with the product role the control needs | No |
| Connect a repository, manage tokens and reporter settings, resync | Yes, product owner or admin | No |
| Review and merge pull requests in GitHub | Yes, collaborators with write access | No GitHub write access |
| Release to production | Yes: run the promote workflow (private repo) or approve the `production` environment (public repo) | No |
| Change Google Cloud | Only through the deploy workflow; bootstrap by the platform owner | No |

## How it is enforced
- **Studio** checks the staff rule on its server for every build action, using the verified email on the sign in account (not anything a user can edit). Being an app admin or a product owner is not enough without a `@solutionment.com` account. Refused attempts are recorded in the control history.
- **GitHub**: repositories live under the `solutionment` account (GitHub Pro, private). Only Solutionment staff are collaborators with write access; clients get read access at most, or none. The `main` ruleset requires a pull request and a code owner approval. Production is released by running the promote workflow, which only people with write access can start (ADR 0005).
- **Agents** start only from a label added by someone with write access, or by Studio's GitHub App after Studio's staff check (`agent-run.yml`).
- **Google Cloud**: no client accounts. The deploy workflow is the only path to change staging or production.
