# Academic Research Skills Integration

This project now embeds the most useful parts of `academic-research-skills-main` directly into the ResearchFlow generation pipeline.

## What Was Integrated

- `deep-research` source discipline: source quality hierarchy, contradiction disclosure, conservative synthesis, and no unsupported claims.
- `academic-paper` writing discipline: thematic literature synthesis, section-specific academic writing, limitations, mandatory scholarly statements, and citation integrity.
- `academic-pipeline` quality gates: a lightweight post-citation integrity audit before visualization and formatting.
- `academic-paper-reviewer` review mindset: traceability, specificity, and no fabricated critique or evidence.

## Runtime Entry Points

- `api/agents/researchSkillGuidance.ts` contains reusable protocol text and helpers used by generation agents.
- `api/agents/sectionPlanner.ts` uses the structure rules to produce topic-specific section plans with a limitations section by default.
- `api/agents/extractAgent.ts` extracts source-grounded findings, contradictions, and gaps instead of generic summaries.
- `api/agents/writingAgent.ts` injects the writing, evidence, and citation integrity protocol into every section draft.
- `api/agents/integrityAgent.ts` runs a local audit for invalid citation markers, missing required statements, DOI metadata drift, and evidence-risk warnings.
- `api/agents/orchestrator.ts` now includes the new `integrity_reviewing` stage before charting and formatting.

## Current Scope

The integration is intentionally lightweight and production-safe:

- It does not copy every skill markdown file into prompts, which would make calls too long and brittle.
- It keeps the strongest rules as compact runtime protocols.
- It blocks only critical citation-number errors. Other issues are surfaced as warnings so users can still inspect and improve drafts.

## Good Next Steps

- Persist the integrity audit report per project instead of storing it only in progress messages.
- Add a reviewer mode that uses the `academic-paper-reviewer` rubric to produce a separate revision roadmap.
- Add a systematic-review mode that uses PRISMA-style screening fields and literature matrices.
- Add UI affordances for required statements, such as Data Availability, Ethics, Funding, Conflict of Interest, CRediT, and AI Disclosure.
