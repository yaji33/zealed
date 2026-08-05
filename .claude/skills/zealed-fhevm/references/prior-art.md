# Prior Art & References

Curated for Zealed. Everything below was verified live (Aug 2026), not recalled from memory. Two categories: agent-facing fhEVM skill packages (install these directly), and prior winner projects worth reading for architecture ideas (read, don't install).

## Install directly: agent-facing fhEVM skills

These were built *as* SKILL.md packages in prior bounty seasons, specifically so agents like Claude Code and Cursor could write correct fhEVM code without hallucinating the API. Both are more complete on generic fhEVM syntax than the project-specific `SKILL.md` in this repo, which assumes you already have one of these loaded.

**`0xE1337/fhevm-skill`** — Season 2/3-era submission, MIT licensed. Ships a `SKILL.md` with 9 reference docs (architecture, encrypted types, FHE operations + gas costs, ACL, input validation, decryption patterns, Hardhat testing, Foundry testing, frontend integration), 6 worked example contracts including a full `ConfidentialTreasury.sol` with a passing 15-test suite, a 20-item anti-pattern catalog split into logic/operational/privacy-boundary layers, and a 12-rule static linter (`scripts/fhevm-lint.js`, zero dependencies).
Install: `npx skills add 0xE1337/fhevm-skill` or as a Claude Code plugin via `/plugin marketplace add 0xE1337/fhevm-skill`.
Repo: https://github.com/0xE1337/fhevm-skill

**`Makabeez/fhevm-skill`** — Zama Developer Program Mainnet Season 2 Bounty Track submission. 14-section `SKILL.md` covering project setup, encrypted types, a canonical contract template, the full FHE operations cheatsheet, ACL rules with a worked token-transfer example, frontend integration (TS + browser), async decryption deep dive, testing, deployment, a 13-item anti-pattern list (AP-001 through AP-013, each with wrong/correct code), a gas optimization table, and a complete confidential ERC-20 dApp example. Also ships its own linter.
Install: `npx skills add Makabeez/fhevm-skill`
Repo: https://github.com/Makabeez/fhevm-skill
Forum writeup: https://community.zama.org/t/fhevm-skill-portable-fhevm-skill-for-ai-coding-agents/4405

**Note on currency:** both of these document the Oracle/gateway-callback decryption pattern (`requestDecryption` → `onlyGateway` callback). Per Section 0 of this repo's `SKILL.md`, FHEVM v0.9 introduced a self-relaying decryption model that may supersede this for public-decrypt flows depending on which package versions this repo pins. Check before copying their decryption examples verbatim.

## Read for architecture ideas: prior winning projects

None of these are prize-savings apps specifically (Zealed is the first season this exact bounty has run), but each solves an adjacent "keep amounts private while keeping the mechanism verifiable" problem and is worth skimming for patterns.

- **Ghostlend** (Season 3) — confidential lending and leverage, with debt and leverage ratio encrypted. Relevant for how it handles encrypted health-factor-style comparisons without leaking position size — similar shape to Zealed's ticket-range comparison.
- **Veilflow** (Season 3, TokenOps special bounty) — confidential token distribution console (airdrops, vesting, disperse) with every amount FHE-encrypted end to end. Relevant for the deposit/credit accounting pattern.
- **Confidential Safe Wallet** (Season 3) — adds a Zama confidentiality layer on top of Gnosis Safe's multisig/module architecture. Repo: https://github.com/00Xchriswilder-fhevm-hub/safe-wallet-monorepo/tree/feat/erc-7984-zama
- **Contracks** (Season 1) — confidential legal agreements platform, private-by-default with on-chain enforcement. Relevant for its ACL-per-party pattern (multiple addresses needing different read access to the same encrypted state), which is close to what Zealed needs if a prize needs to be visible to both the winner and, say, a protocol dashboard aggregate.
- **CipherMint** (Season 1) — confidential UBI, encrypted per-identity distribution amounts with verifiable-but-private disbursement. Conceptually the closest prior art to a "periodic payout, amount hidden, distribution verifiable" mechanism, even though the domain (UBI vs. prize draw) differs.

Full winner writeups: https://www.zama.org/post/announcing-the-developer-program-mainnet-season-1-winners, https://www.zama.org/post/announcing-the-developer-program-mainnet-season-2-winners, https://www.zama.org/post/announcing-the-developer-program-mainnet-season-3-winners

## Official documentation (primary source, check first when in doubt)

- `docs.zama.org/protocol/solidity-guides` — encrypted types, FHE operations, ACL, contract patterns. Start here for any Solidity question.
- `docs.zama.org/protocol/solidity-guides/development-guide/migration` — the v0.9 self-relaying migration guide referenced in Section 0 of `SKILL.md`. Read this before implementing any decryption flow.
- `docs.zama.org/protocol/relayer-sdk-guides` — client-side encrypt/decrypt, `@zama-fhe/relayer-sdk`, `FhevmInstance` setup, `SepoliaConfig`.
- `docs.zama.org/protocol/zama-protocol-litepaper` — architecture background (symbolic execution, host chain vs. gateway chain, why the host chain never runs actual FHE compute).
- `github.com/zama-ai/fhevm` — the core FHEVM framework repo.
- `github.com/zama-ai/fhevm-hardhat-template` — official Hardhat starter template; `0xE1337/fhevm-skill`'s `verify.sh` clones this directly to confirm its examples compile and pass.
- `github.com/zama-ai/awesome-zama` — curated list of talks, papers, and tooling maintained by the Zama team; useful as a jumping-off point for anything not covered above.

## What's deliberately not in this file

No links to unofficial tutorials, blog posts, or third-party explainers that weren't verified live. If something's needed that isn't covered here, check the official docs first, then ask before treating an unverified source as ground truth — fhEVM's API has moved enough between versions that stale tutorials are a real risk (see Section 0 of `SKILL.md`).