# Solutionment Studio architecture

`index.html` is the architecture handbook for Solutionment Studio, our end to end, AI enabled product engineering platform. It covers SolutionIQ Studio (built in Lovable), GitHub, Claude and the 13 agent team, and Google Cloud, with narrative, tables and seven figures.

## Reading it

GitHub shows HTML files as source code. To read the designed page:

- Open `index.html` in a browser from a local clone or a codespace (`python3 -m http.server` in this folder, then open the forwarded port), or
- Ask the platform owner for access to the published copy in Claude.

## Sections

1. What it is
2. Principles
3. System map (Figure 1)
4. SolutionIQ Studio
5. GitHub
6. Claude and the agent team (Figure 2)
7. Google Cloud (Figure 3)
8. A work item, end to end (Figures 4 and 5)
9. Build, deploy, release (Figure 6)
10. Live visibility (Figure 7)
11. Trust and security
12. Cost
13. The pilot: Mini Philia
14. Status and next steps
15. Moving to Claude Teams
16. Glossary and reference

## Keeping it current

The handbook describes the platform as of 14 November 2026. Update it in the same pull request as any change to a principle, an agent, a workflow, the Google Cloud layout or the Studio integration. The Story analyst agent owns keeping it accurate. Section 14 (Status and next steps) goes stale fastest.

The page is self contained: one HTML file with its styles inline. It loads Lato and IBM Plex Mono from Google Fonts and Mermaid from jsDelivr for Figures 4 and 5. Keep user facing text free of em dashes, as everywhere in this repository.
