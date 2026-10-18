# AttendAI system documentation

This is the current reference for the codebase. It was written after the 2026-10 attendance redesign and UI revamp. Start with the root [AGENTS.md](../../AGENTS.md) for the quick orientation, then read whichever of these you need:

| Doc | Read it when you're… |
|---|---|
| [architecture.md](architecture.md) | getting oriented: components, backend layout, domain services, key flows, auth, config, running locally |
| [domain-rules.md](domain-rules.md) | changing anything about attendance, sessions, terms, holidays, auto-absent, percentages or permissions. **These rules are authoritative.** |
| [face-verification.md](face-verification.md) | changing face enrolment, check-in, liveness, anti-spoofing, presence codes or the face policy. **These rules are authoritative.** |
| [database.md](database.md) | touching models, queries or migrations |
| [api-reference.md](api-reference.md) | adding or changing endpoints, or wiring the frontend to them |
| [frontend.md](frontend.md) | working on React screens, the design system or the API client |
| [testing.md](testing.md) | running or writing tests |
| [known-issues.md](known-issues.md) | checking technical debt, current operational state and pitfalls first |

**Keep these docs current.** A change isn't finished until the matching doc describes it. The "Keeping docs current" table in [AGENTS.md](../../AGENTS.md) says which file to update for each kind of change. When the code and a doc disagree, the code wins: fix the doc.
