# Oversikt Roadmap — Current Priorities

Last updated: 2026-02-26

## NOW — V1 Public Launch (Mar–Apr 2026)

Critical path: **Rebrand → Landing Page → Domain → Encryption → Public V1**

| Initiative | Priority | Effort | Target | Status | Depends On |
|-----------|----------|--------|--------|--------|------------|
| Complete Oversikt rebrand (codebase, repo, DNS) | P0 | M | Mar W1 | In Progress | — |
| Fix #8: Date not driving income-this-month | P0 | S | Mar W1 | At Risk | — |
| Fix #14: Formatting issues | P0 | S | Mar W1 | At Risk | — |
| Fix 9 pre-existing test failures | P1 | S | Mar W2 | Not Started | — |
| Landing page + demo mode (R9.4–R9.5) | P0 | M | Mar W2 | In Progress | Rebrand |
| Production token encryption enforcement | P0 | S | Mar W3 | Not Started | Domain setup |
| Domain launch + deployment finalization | P0 | S | Mar W3 | Not Started | Rebrand, landing page |
| Auto-categorization refinement (R1.8) | P1 | M | Apr W1 | Not Started | V1 launch |
| Onboarding flow polish (guided setup wizard) | P1 | M | Apr W2 | Not Started | Landing page |

### Success Criteria
- 0 P0 bugs, 432/432 tests passing
- Demo mode completable in under 3 minutes
- Public URL live with production encryption

## NEXT — V2 Foundation (May–Jun 2026)

| Initiative | Priority | Effort | Target | Depends On |
|-----------|----------|--------|--------|------------|
| Spending benchmarks (BLS data engine) | P1 | L | May W1–W3 | Engine extraction |
| Smart debt payoff modeling (avalanche/snowball) | P1 | L | May W2–Jun W1 | Debt model |
| Enhanced transaction search + filtering | P2 | M | May W3 | — |
| Recurring transaction detection + automation | P1 | M | Jun W1 | Auto-categorization |
| CSV export + data portability | P2 | S | Jun W2 | — |
| Monthly Review enhancements (goal tracking) | P2 | M | Jun W3 | Monthly Review live |

### Success Criteria
- 5+ weekly active users
- 10+ transactions/user/week

## LATER — V2 Vision (Jul–Aug 2026)

| Initiative | Priority | Effort | Target | Depends On |
|-----------|----------|--------|--------|------------|
| Tax optimization engine (deductions, Schedule E) | P2 | XL | Jul–Aug | Tax rules engine, BLS |
| Multi-user household (shared access + permissions) | P2 | XL | Jul–Aug | Auth redesign |
| CPA integration API layer | P3 | L | Aug | Tax engine |
| Own-history benchmarking (year-over-year trends) | P2 | M | Jul W2 | Monthly snapshots |
| Push notifications (budget alerts, bill reminders) | P3 | M | Aug | Recurring detection |

### Success Criteria
- Users actively using benchmarks or debt modeling

---

## Sizing Reference
S = 1 week | M = 2–3 weeks | L = 4–6 weeks | XL = 8+ weeks

## Notes
- Roadmap deliberately overloaded in Next/Later — expect 40–50% to slip or be cut based on user feedback
- Capacity: ~20–25 productive hours/week
- See \`docs/briefs/\` for detailed specs on items being actively built
