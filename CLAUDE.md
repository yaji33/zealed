# CLAUDE.md — Agent Steering File

This file is read by Claude Code and should be treated as authoritative by Cursor as well. It defines constraints, not just preferences. See `docs/architecture.md` and `build-brief.md` for full design context — do not re-derive architecture decisions, reference them.

## What this project is

Confidential prize savings protocol (fhEVM), built for the Zama Season 4 bounty. Deadline Sep 5, 2026. Solo developer, pnpm monorepo, Hardhat contracts + Next.js frontend.

## Non-negotiable constraints

1. **Never loop over all users to compute a draw winner on-chain.** Winner selection is pull-based: each user calls `checkIfWon()` for themselves, one encrypted comparison, O(1) protocol-side cost. If you find yourself writing a `for` loop over depositors inside `DrawManager.sol`, stop — that's the wrong pattern, re-read `build-brief.md` Section 5.
2. **Never emit plaintext amounts in events or logs.** Deposit/withdraw/prize events signal that an action occurred, never the value. This applies to test fixtures and console.log debugging too — don't leave decrypted values in committed code.
3. **Principal withdrawal has no lockup, ever.** This is a hard bounty requirement, not a design choice up for revisiting mid-build.
4. **Randomness (`r`) is the only thing allowed to be plaintext in the draw flow.** Everything it's compared against (individual ticket ranges) stays encrypted.
5. **Use Zama's existing cUSDC / Wrappers Registry token, do not build a custom confidential ERC-20.** Reinventing this wastes the timeline and adds unaudited surface area.
6. **Decryption only happens client-side via the user-decrypt / EIP-712 permit flow.** No server-side decryption path, no admin decrypt function on any user's individual balance or prize, under any circumstance — including for debugging. If you need to debug a value, decrypt it in a local test with the test wallet's own key, never add a decrypt-any-user function to a deployed contract.

## Workflow expectations

- Work in small, reviewable commits scoped to one contract or one frontend flow at a time. Don't batch vault + draw manager + frontend into one commit.
- Every contract change needs a corresponding test before it's considered done, not after. Particularly for `checkIfWon()` — this is the least conventional part of the system and the most likely place for an off-by-one or range-boundary bug.
- Before implementing a new feature, check Section 10 of `build-brief.md` ("Explicitly Out of Scope"). If it's on that list, don't build it, flag it back instead. Scope creep is the main risk against the Sep 5 deadline, not technical difficulty.
- When stuck on an fhEVM-specific pattern (encrypted comparisons, input proofs, decryption oracle calls), check Zama's official docs/examples first rather than guessing at an API shape — the FHE type system doesn't behave like normal Solidity and wrong guesses compile but fail silently or revert unhelpfully.

## Definition of done for any given task

A task is done when: it has a test, it doesn't violate any constraint above, and it maps to a specific checklist item in `build-brief.md` Section 2 or is explicitly part of the "ship-if-time" tier in Section 9. If a task doesn't map to either, ask before building it.

## Style

- TypeScript strict mode, no `any` without a comment explaining why
- Solidity: NatSpec on every external/public function, especially anything touching encrypted state, since a reviewer (possibly OpenZeppelin, if this submission is selected) will be reading intent from comments as much as code
- No decorative complexity — this is a bounty judged on production-readiness, not on how much surface area was built