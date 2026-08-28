---
name: zealed-fhevm
description: Build, test, and deploy Zealed's confidential prize-savings contracts on the Zama Protocol (fhEVM). Use this skill whenever writing or reviewing Solidity that touches encrypted types (euint/ebool/eaddress), ACL grants, encrypted inputs, decryption flows, the pull-based draw pattern, or Hardhat tests/deploy scripts for this repo. Load this skill for any file under packages/contracts/.
---

# Zealed fhEVM Skill

This is the project-specific skill for Zealed (confidential PoolTogether, Zama Season 4 bounty). It assumes the agent already has general Solidity competence and focuses on what's specific to fhEVM and to this repo's architecture. Reference `build-brief.md` and `CLAUDE.md` at the repo root for product/architecture context — this file is the technical API layer underneath those.

**Companion skills, install these too:** this file does not duplicate the full generic fhEVM API reference. Two community-built skills from prior Zama Developer Program bounty seasons already cover that ground in depth and are designed to be dropped into an agent's context:

```
npx skills add 0xE1337/fhevm-skill
npx skills add Makabeez/fhevm-skill
```

Both were built specifically as agent-facing FHEVM references (Season 2/3 bounty submissions) with worked examples, anti-pattern catalogs, and static linters. See `references/prior-art.md` in this repo for what each one contains and where they overlap. Use them for general fhEVM syntax questions; use this file for anything Zealed-specific.

## Maintenance Protocol — this file is a living document

This skill grows with the build. It should not stay static from Week 1 to submission. After any module ships (vault, ticket engine, draw manager, claim flow, frontend integration), whoever ships it — agent or Jay — does two things before moving on:

1. **Append an entry to the Build Log (Section 9, bottom of this file).** One short block: what shipped, what was learned, date/milestone. Keep it terse, this is a log, not a report.
2. **Promote durable rules into the numbered sections above.** If something discovered while building is a rule that should bind *future* code (not just describe what happened), it doesn't just live in the log — it gets folded into Section 1–6 as an actual constraint, the way the silent-zero-on-encrypted-branch rule and the `setOperator` deposit note were folded into Sections 3 and 5 after the vault shipped. The log is the audit trail of when and why; the numbered sections are the enforced current state.

Keep `.cursor/rules/fhevm-contracts.mdc` in sync with the numbered sections (1–6) only — that file stays lean and scoped per Cursor's context-budget conventions, so the Build Log does not get mirrored there. Cursor gets the current rules, this file gets the current rules plus the history of how they were arrived at.

## 0 — Version currency warning (check this first)

fhEVM has moved fast. As of this writing, **FHEVM v0.9 shifted decryption from an Oracle/gateway-callback model to a self-relaying model**: the client performs off-chain decryption via `@zama-fhe/relayer-sdk` and re-submits with `FHE.verifySignatures()`, rather than the contract receiving a `requestDecryption(...) → onlyGateway callback` round trip.

Some public FHEVM examples, including some agent-skill packages, still document the older callback pattern. Before implementing any decryption flow in this repo:

1. Check the installed `@fhevm/solidity` and `@fhevm/hardhat-plugin` versions in `package.json`.
2. Check `docs.zama.org/protocol/solidity-guides` for the migration guide matching that version.
3. If in doubt, prefer the self-relaying / `verifySignatures` pattern — it's the direction the protocol is moving, and it's the one that will still be current when this ships to Sepolia in September.

This matters most for Zealed's `checkIfWon()` and prize-claim flow, both of which are decryption-adjacent.

## 1 — Encrypted Types

| Type | Plaintext equivalent | Use in Zealed |
|---|---|---|
| `ebool` | `bool` | draw-result flags, `canWithdraw` checks |
| `euint64` | `uint64` | balances, TWAB, ticket weights, prize amounts — default choice |
| `euint128` / `euint256` | wider ints | avoid unless a value genuinely needs more range than `euint64`; costs more per operation |
| `eaddress` | `address` | only if we ever need to encrypt a recipient address; not currently needed |
| `externalEuintXX` / `externalEbool` | — | input-only wrapper types, function parameters, **never store these** |

Rule: default to `euint64` for every amount in this contract set (balances, TWAB, ticket ranges, prize amounts). Only widen if a specific calculation can overflow it, and document why.

## 2 — Required Contract Skeleton

Every contract in `packages/contracts/contracts/` follows this shape:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol"; // Sepolia only, per build-brief.md

contract SomeZealedContract is SepoliaConfig {
    // encrypted state only ever stores euintXX / ebool / eaddress, never external* types
}
```

Non-negotiables (see `CLAUDE.md` for the full list, this is the fhEVM-specific subset):

- Every `FHE.fromExternal(input, proof)` call is immediately followed by `FHE.allowThis(...)`, and by `FHE.allow(..., user)` for any address that needs to read the result later.
- Every arithmetic or comparison op produces a **new handle** with no ACL — re-grant `allowThis`/`allow` after every single FHE operation before it's stored or returned, not just at the end of a function.
- Never `if`/`else` branch on an `ebool`. Use `FHE.select(condition, ifTrue, ifFalse)`.
- Never store an `externalEuintXX` — convert with `FHE.fromExternal` first.
- Never reuse an `inputProof` across transactions — it's a one-time ZKPoK bound to that specific call.

## 3 — Zealed-Specific Pattern: Pull-Based Draw Check via Ticket Tree

This is the one pattern in this codebase that isn't in any generic fhEVM reference, because it's Zealed's own architecture decision (see `build-brief.md` Section 5). Get this exactly right — it's the part most likely to be scrutinized if this submission is reviewed for the OpenZeppelin audit path.

**Do not** implement winner selection as a loop over depositors. **Do not** store a per-user cumulative start offset directly, either — that reintroduces an O(n) update on every other user's data whenever one user's weight changes, just moved from the draw to the deposit path. Instead:

- `TicketEngine` maintains a **Fenwick tree (binary indexed tree)** over encrypted per-user weights. Each depositor gets a permanent index slot on first deposit, never reused.
- Deposit/withdraw call `update(index, delta)`: O(log n) tree nodes touched, pure encrypted addition, no comparisons, no effect on any other user's slot.
- `checkIfWon` computes the caller's cumulative start on demand via an O(log n) encrypted prefix-sum query — not from stored state — then does one encrypted range comparison against the public draw value `r`.
- Fenwick walks **must** be bounded by a fixed `MAX_DEPOSITORS` (do not loop until `uint256` overflow). An unbounded walk burns ~256 FHE ops and hits `HCUTransactionLimitExceeded` (20M HCU/tx). Cap at `type(uint16).max` or smaller.
- `syncWeightFromVault` **no-ops while frozen** (never reverts). Principal withdraw has no lockup — a frozen ticket tree must not block `ConfidentialVault.withdraw`. Self-service `syncWeight` may still revert when frozen. Weights catch up on the next vault sync after unfreeze.

```solidity
// DrawManager.sol — sketch, not final implementation

uint64 public drawRandomValue; // r — PLAINTEXT, public, finalized via commit-reveal
uint256 public drawId;

mapping(uint256 => mapping(address => bool)) public hasChecked; // per-draw, per-user

function checkIfWon(uint256 _drawId) external {
    require(_drawId == drawId, "not current draw");
    require(!hasChecked[_drawId][msg.sender], "already checked");
    hasChecked[_drawId][msg.sender] = true;

    // TicketEngine.prefixSum(index) walks O(log n) tree nodes to compute
    // this caller's cumulative start — not read from persistent storage.
    euint64 start  = ticketEngine.prefixSum(indexOf[msg.sender]);
    euint64 weight = ticketEngine.weightOf(indexOf[msg.sender]);
    euint64 end    = FHE.add(start, weight);
    euint64 rEnc   = FHE.asEuint64(drawRandomValue);

    ebool inRange = FHE.and(FHE.ge(rEnc, start), FHE.lt(rEnc, end));

    euint64 prize = FHE.select(inRange, _currentPrizeAmount(), FHE.asEuint64(0));
    FHE.allowThis(prize);
    FHE.allow(prize, msg.sender);
    _pendingPrize[msg.sender] = prize;
}
```

Why this shape specifically:

- `r` is the only plaintext value in the comparison. It reveals nothing about any individual's position, only where the random draw landed in the total ticket space.
- The comparison happens once per user, on demand, paid by the caller. No function in this contract should ever loop over a mapping of all depositors — if an agent writes one, that's a signal to stop and re-read this section.
- `hasChecked` prevents a user from calling repeatedly to grind for a different result (the result is deterministic per draw regardless, but the guard also caps gas griefing).
- The prize result is stored per-user, ACL-gated to that user only, and claimed/decrypted separately (Section 4).

Total ticket count (needed to bound `r`) is the tree's root-level running sum, publicly decrypted via the self-relay flow at draw time — revealing the aggregate is fine, same disclosure category as the public TVL figure already on the aggregate dashboard.

## 4 — Prize Claim / Decryption

Once `checkIfWon` has set `_pendingPrize[msg.sender]`, the user decrypts it client-side via the relayer SDK's user-decryption flow (EIP-712 signed permit), not via any on-chain admin path. Optional `revealWin()` (build-brief §9) does **not** decrypt the prize amount: it stores a publicly decryptable `ebool` win flag at check time, then verifies that flag via self-relay `publicDecrypt` + `FHE.checkSignatures` and emits `WinRevealed(drawId, account, tier)` only. Never add an admin/server decrypt path for balances or prizes.

## 5 — Testing

Use Hardhat mock FHE mode for all unit tests (fast, no testnet, FHE ops computed in plaintext locally under the hood):

```typescript
// packages/contracts/test/DrawManager.test.ts
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";

describe("DrawManager.checkIfWon", () => {
  it("does not loop over depositors and settles in O(1) gas regardless of pool size", async () => {
    // Seed N depositors, confirm checkIfWon gas cost for one caller doesn't scale with N.
    // This test exists specifically to guard the architecture decision in Section 3.
  });

  it("a user outside the drawn range receives a zero prize, not a revert", async () => {
    // Losing must be a silent, encrypted zero — not an error path that leaks who lost.
  });
});
```

Two tests worth calling out because they test the *architecture*, not just correctness:

1. A gas-regression test confirming `checkIfWon` cost scales logarithmically (O(log n)) with total depositor count, not linearly — the whole point of the Fenwick tree design is that this holds.
2. A confirmation that losing produces an encrypted zero, not a revert or a plaintext signal — a revert-on-loss pattern would leak win/loss information through transaction success/failure, which defeats the privacy goal even though no balance leaked.

**This principle is repo-wide, not draw-specific.** `ConfidentialVault.withdraw()` already applies it: an oversized withdrawal resolves to a zero-value no-op via `FHE.select` rather than a revert. Apply the same shape to any future function whose success depends on an encrypted comparison.

**Deposit/withdraw integration:** callers must call `setOperator(vaultAddress, ...)` on the underlying confidential asset before the vault can pull funds — same shape as an ERC-20 `approve()` before `transferFrom()`. The vault verifies the encrypted input, then pulls via the `euint64` `confidentialTransferFrom` overload. Needed by the Week 3 frontend deposit flow.

## 6 — Deployment

Sepolia only for this bounty (per `build-brief.md`). Inherit `SepoliaConfig`, never hardcode gateway/relayer addresses directly in a contract — pull them from the config import so a config change doesn't require a contract rewrite.

## 7 — Frontend styling (`apps/web`)

Tailwind v4 utilities in JSX are the standard for all UI in `apps/web`. Design tokens live in `tailwind.config.ts` (`void` landing ground, `base` in-app ground `#111113`, `surface` card fill `#232325`, `edge` card border `#2F2F31`, `ink`, `ember`, `mint`, `muted`, `line`, plus dashboard semantics `elevated`, `soft`, `accent`, `public`, `private`, `danger`, `ok`). Use `bg-base`, `bg-surface`, `border-edge`, `text-ember`, `border-line`, `font-mono`, etc. — not ad-hoc hex in components.

`globals.css` is **tokens and resets only**: `@import "tailwindcss"`, `@config`, Google Fonts import, base-layer resets (`html`, `body`, `a`, `code`). No bespoke component classes (`.landing-*`, `.panel`, `.btn`, …). Dashboard panels/buttons that repeat long class strings may import shared constants from `src/lib/uiClasses.ts`; do not add new named classes to `globals.css` to work around Tailwind.

Dot-matrix / ASCII art (`AsciiPoolField`): rendering logic stays in TS; only outer layout uses Tailwind on the component wrapper.

## 8 — Reference Index

- `references/prior-art.md` — annotated list of prior Zama Developer Program winner repos relevant to this build (vaults, treasuries, confidential distribution patterns) plus links to the official docs sections this skill draws from.
- Official docs: `docs.zama.org/protocol/solidity-guides` (encrypted types, ACL, operations), `docs.zama.org/protocol/relayer-sdk-guides` (client-side encrypt/decrypt), `docs.zama.org/protocol/zama-protocol-litepaper` (architecture background if you need to explain *why* symbolic execution works this way).

## 9 — Build Log

Append here after each module ships. Newest entry on top. See Maintenance Protocol above for what does and doesn't belong here versus in Sections 1–6.

---

**Frontend — dashboard tab bar affordance.**
Position action tabs are left-aligned with `gap-7` (not `flex-1`). Active tab uses a 2px ember underline under the label plus `text-ink`; inactive stay `text-muted` with hover brighten and a faint ember underline. Hairline `border-line` under the row. Panel content unchanged.

---

**Frontend — dashboard action tabs.**
Replaced the four stacked approve/deposit/withdraw/claim cards with one `rounded-2xl` surface card (`Deposit` / `Withdraw` / `Claim`). Default tab is Claim when the wallet has an unchecked settled draw, else Deposit. Approve is a blocking step on Deposit until `setOperator` lands, then a one-line "Vault approved" row. Claim uses the full check/decrypt flow only when there is work; otherwise a quiet empty state. Tab panels stay mounted (`hidden`), so balance/approval queries are not refetched on switch. Faucet unchanged.

---

**Frontend — in-app base/surface tokens.**
`base` `#111113` (in-app page) and `surface` `#232325` (flat card fill) in `tailwind.config.ts`. Dashboard/faucet use `bg-base`; `uiClasses` cards drop the `#1a1a1a→#0f0f0f` gradient for `bg-surface`. Landing stays on `void`. `muted` 0.60→0.65 for ink on surface. Section 7 updated.

---

**Frontend — faucet two-column layout.**
Get cUSDC card is steps left / status panel right (flow status, folded Wrapped metric). Stepper rail is 2px with fill, larger markers, check on complete. Stacks below `lg`. `/faucet` redirects to `/dashboard/faucet`.

---

**Frontend — faucet route + connected stepper.**
Moved mint/approve/wrap off `/dashboard` onto `/dashboard/faucet`. In-app nav: Home/App replaced by Faucet (LandingHero sizing kept). Single-card stepper with filling rail, locked future steps, mint stamp animation slot (image/Lottie/SVG, SVG fallback), wrapped total from underlying Transfer logs (not local-only). Dashboard deposit flow unchanged.

---

**Week 4 — landing page (`apps/web`), full Tailwind migration.**

Reconciled design tokens into `tailwind.config.ts` (single source: `void`/`ink`/`ember`/`mint`/`line`/`muted` + dashboard `elevated`/`soft`/`accent`/`public`/`private`/`danger`/`ok`). Removed all bespoke component classes from `globals.css` (landing, pool field, dashboard panels/stats/buttons/tables). Landing (`page.tsx`, `AsciiPoolField`, `HowItWorksSection`, `StepDotIcon` layout) and dashboard (`SiteHeader`, `PrivateDashboard`, `PublicOverview`) now use Tailwind utilities in JSX; repeated dashboard strings live in `src/lib/uiClasses.ts`. Promoted Section 7 (frontend styling convention).

---
Installed Tailwind v4 (`@tailwindcss/postcss`, `tailwind.config.ts` for ember/ink tokens + keyframes). "How it works" moved to `HowItWorksSection.tsx` + `StepDotIcon.tsx` with utility classes only; removed all `.landing-step*` / `.step-glyph*` from `globals.css`. Cards: `grid-cols-1 sm:grid-cols-2`, `max-w-xl` grid, `max-w-[16.5rem]` per card. Hover fixed via `group`/`group-hover:` on `<article>` (no mount animation). Dot-matrix icons rebuilt per step: deposit absorb (1,000 → bracket fill), yield bars L→R + baseline + `+`, draw noise field + legible 4217, claim mid-open lock + 2,340 through gap.

---

**Week 4 — landing page (`apps/web`), how-it-works refactor.**
"How it works" cards: dropped 1px bordered boxes and interior grid backgrounds. Bracket-corner frame (hairline L-marks, dotted rule between icon and copy), step index `01`–`04` in IBM Plex Mono tucked at top-left near the bracket. Line-art CSS diagrams replaced with `StepDotIcon.tsx`: deterministic 32×24 dot-matrix halftone per step (deposit token→vault, yield bars, draw noise→public value, claim lock→prize), ember dots at varying opacity/scale; hover sharpens shape and fades ambient noise (200ms, no card lift; `prefers-reduced-motion` falls back to opacity only). Copy, order, and section title unchanged.

---

**Week 4 — landing page (`apps/web`).**
Full marketing landing at `/`: hero (hero-bg.png asset, DM Sans headline, Fraunces italic accent), then how it works (zigzag, per-step ASCII glyph art), visible vs sealed, under the hood (contract cards linking Sepolia Etherscan), FAQ, footer. Hero stat row replaced with an ASCII halftone "pool surface" (`AsciiPoolField.tsx`): seeded deterministic glyph grid (SSR-safe), ember noise as the encrypted field, live plaintext stats (TVL public-decrypt, `prizeAmountPlain`, reveal-block countdown) surfacing over it; stats are real DOM text, grid is `aria-hidden`, flicker respects `prefers-reduced-motion`. Layout split: root layout is now bare (fonts + providers), dashboard keeps the old `.shell` + `SiteHeader` chrome. Design tokens: #0A0A0A ground, #F5F3EE ink, ember #FF5A33 sole accent, mint #B8F5E6 only on Launch App. No em dashes in copy.

---

**Week 4 / Sepolia deploy.** Deployed + Etherscan-verified: Vault `0xD108…3935`, TicketEngine `0x59B2…2429`, DrawManager `0x2D21…E233` against cUSDCMock `0x7c5B…3639`. Live smoke via Relayer SDK: deposit/withdraw/TVL + draw reveal/`checkIfWon`/prize user-decrypt. Frontend env pointed at these addresses; production build served publicly (Cloudflare quick tunnel). Hardhat mock FHE does not init on Sepolia — use Relayer SDK + explicit gasLimits for live scripts.

---

**Week 4 — public vault TVL + `revealWin` selective disclosure.**
`ConfidentialVault`: running `euint64 _totalDeposits` via encrypted add/sub on deposit/withdraw (oversized withdraw uses encrypted-zero `toWithdraw` so TVL is unchanged); `totalDeposits()` + self-relay public decrypt (same class as TicketEngine.totalTickets). `apps/web` public view reads real TVL. `DrawManager.revealWin`: stores publicly decryptable `ebool` at `checkIfWon`, verifies via `checkSignatures`, emits `WinRevealed` with tier only; dashboard toggle off by default. Security pass: no per-user plaintext amounts in events; external-call paths stay `nonReentrant`; existing commit-reveal tests still pass.

---

**Week 3 — frontend scaffold (`apps/web`).**
Next.js 15 + wagmi/viem + `@zama-fhe/relayer-sdk` 0.4.1. Public view: draw history + prize/yield aggregates from events; TVL completed in Week 4. Private dashboard: explicit `setOperator` step, deposit/withdraw with client encrypt, user-decrypt EIP-712 for balance/TWAB/weight/prize, `checkIfWon` + decrypt pending prize + optional `revealWin` (Week 4).

---

**Week 2 — vault ↔ TicketEngine wiring.**
`ConfidentialVault.setTicketEngine` (onlyOwner, zero-address guard). Deposit/withdraw end with `FHE.allowTransient(twab, ticketEngine)` + `syncWeightFromVault`. Hard rule: `syncWeightFromVault` **no-ops while frozen** (does not revert) so principal withdraw never fails during an active draw; self-service `syncWeight` still reverts when frozen. Test: withdraw succeeds while frozen, weight lags, catches up to TWAB after unfreeze. Original 6 vault tests unchanged and still passing.

---

**Week 2 — TicketEngine + DrawManager shipped.**
Fenwick tree over `euint64` weights (`TicketEngine.sol`): permanent 1-based slots, `syncWeight` / `syncWeightFromVault`, on-demand `prefixSumBefore` / `weightOf`, publicly decryptable `totalTickets`. `DrawManager.sol`: commit → future `blockhash` reveal with KMS `checkSignatures` on total, pull-based `checkIfWon` with `FHE.select` silent zero on loss, `hasChecked` guard. 7 new tests passing (13 total with vault): lose=encrypted zero, O(log n) gas regression (4 vs 16 depositors), commit-reveal manipulation (too-early / forged proof / 256-block expiry), index permanence, freeze.

Patterns promoted into Section 3:
- Fenwick update/query loops **must** be bounded by a fixed `MAX_DEPOSITORS` (here `type(uint16).max`). Walking until `uint256` overflow does ~256 sequential FHE ops and reverts with `HCUTransactionLimitExceeded` under the 20M HCU/tx cap.
- Vault wiring followed in a separate commit: see "vault ↔ TicketEngine wiring" entry above.

Next: Week 3 frontend.

---

**Frontend — in-app cUSDC faucet.**
Dashboard `CusdcFaucetCard`: mint mock USDC (`0x9b5C…DFfF`) → `approve` cUSDCMock (`0x7c5B…3639`) → `wrap`, matching `smoke-sepolia.ts` / Zama Sepolia protocol-apps addresses. Documented in root README. Relayer SDK does not expose wrapper addresses; sourced from existing smoke script + docs.

**Frontend — Relayer SDK single-flight init.**
`initSDK` has no internal lock; parallel calls from `useVaultTvl` + `useFhevm` raced and surfaced tfhe `unwrap_throw` on decrypt. Shared `lib/relayerSdk.ts` owns one init + one `createInstance` (HTTP RPC for host chain).

**DrawManager guards + Sepolia redeploy (full trio).**
`MIN_REVEAL_DELAY=5`, `MIN_DRAW_INTERVAL=20 minutes`, `lastCommitTimestamp`. Kept post-reveal freeze (path b): `checkIfWon` reads live Fenwick weights, so auto-unfreeze on reveal would let ranges expand against finalized `r`. `deploy-sepolia.ts` redeploys vault+tickets+draw (history resets). New addresses in `deployments/sepolia.json` / web env / README. Dashboard three-state draw pool line.

---

**Pre-Week 2 — design correction: contiguous ticket ranges replaced with a Fenwick tree.**
The original TicketEngine sketch stored each user's cumulative range start directly, assigned contiguously across depositors. Caught before implementation: this means any deposit/withdrawal by an earlier user shifts every later user's stored start, an O(n) update hiding behind an O(1)-looking design — moved the exact problem the pull-based check was built to avoid from the draw path to the deposit path. Replaced with a Fenwick tree (binary indexed tree) over encrypted weights: permanent per-user index slots, O(log n) updates on deposit/withdraw with no cross-user effect, cumulative start computed on demand via O(log n) prefix-sum query at `checkIfWon` time rather than stored. `build-brief.md` Section 5 and this file's Section 3 both updated. Complexity is O(log n), not true O(1) as originally stated — still effectively flat for realistic depositor counts.

---

**Week 1 — ConfidentialVault shipped.**
`@fhevm/solidity` 0.11.1, ERC-7984 via OpenZeppelin confidential contracts, `MockERC7984` as the local cUSDC stand-in. 6 passing tests: zero-address constructor guard, encrypted deposit + TWAB update with no plaintext in events, anytime withdrawal with no lockup, oversized withdrawal resolves to a silent zero transfer, TWAB accrual over time, per-depositor balance isolation.

Patterns discovered and promoted into Sections 3/5:
- The silent-zero-not-revert rule generalizes beyond the draw check — applies to any function branching on an encrypted comparison. First observed in `withdraw()`.
- Deposit requires `setOperator(vaultAddress, ...)` on the underlying asset before the vault can pull funds via `confidentialTransferFrom` — same shape as ERC-20 `approve`/`transferFrom`. Frontend (Week 3) needs to account for this as a separate approval step.

Next: `TicketEngine.sol` (Week 2), building ticket weight directly on the TWAB now in place.