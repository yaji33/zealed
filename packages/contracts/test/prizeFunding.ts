import { expect } from "chai";

import {
  FALLBACK_DRAW_BUDGET_UNITS,
  MAX_UNFORCED_FUNDING_UNITS,
  activeDrawFundingError,
  assertFundingNotALump,
  defaultDrawBudget,
  drawBudgetForVault,
  formatConfidentialTokens,
  fundingUnitsForVault,
  parsePositiveUnits,
  previewAllocateDraw,
} from "../scripts/lib/prizeFunding";

describe("prizeFunding", function () {
  it("parses positive euint64 units and rejects empty or oversized values", function () {
    expect(parsePositiveUnits("20000000")).to.eq(20_000_000n);
    expect(() => parsePositiveUnits("0")).to.throw("Invalid prize funding units.");
    expect(() => parsePositiveUnits((2n ** 64n).toString())).to.throw("Invalid prize funding units.");
  });

  it("keeps cWETH on an ETH-scale per-draw budget and defaults stables to 20 tokens", function () {
    expect(defaultDrawBudget("cusdc")).to.eq(20_000_000n);
    expect(defaultDrawBudget("cweth")).to.eq(20_000n);
    expect(defaultDrawBudget("unknown")).to.eq(FALLBACK_DRAW_BUDGET_UNITS);
  });

  it("lets PRIZE_DRAW_BUDGET_UNITS override the keeper drip without reading PRIZE_FUNDING_UNITS", function () {
    expect(drawBudgetForVault("cusdc", { PRIZE_FUNDING_UNITS: "10000000000" })).to.eq(20_000_000n);
    expect(drawBudgetForVault("cusdc", { PRIZE_DRAW_BUDGET_UNITS: "5000000" })).to.eq(5_000_000n);
  });

  it("uses PRIZE_FUNDING_UNITS only for the explicit fund script", function () {
    expect(fundingUnitsForVault("cusdc", {})).to.eq(20_000_000n);
    expect(fundingUnitsForVault("cusdc", { PRIZE_FUNDING_UNITS: "40000000" })).to.eq(40_000_000n);
  });

  it("refuses an unforced lump that would empty on the next award", function () {
    expect(() => assertFundingNotALump(10_000_000_000n, {})).to.throw("Refusing");
    expect(() => assertFundingNotALump(10_000_000_000n, { FORCE_PRIZE_LUMP: "1" })).not.to.throw();
    expect(() => assertFundingNotALump(MAX_UNFORCED_FUNDING_UNITS, {})).not.to.throw();
  });

  it("previews live Sepolia tier payouts with allocateDraw integer division", function () {
    const preview = previewAllocateDraw(20_000_000n, [5_000n, 3_000n, 1_500n], [1n, 2n, 4n], 500n);
    expect(preview.reserveAdded).to.eq(1_000_000n);
    expect(preview.perSlot).to.deep.eq([10_000_000n, 3_000_000n, 750_000n]);
    expect(formatConfidentialTokens(preview.perSlot[0])).to.eq("10");
    expect(formatConfidentialTokens(preview.perSlot[2])).to.eq("0.75");
  });

  it("explains ActiveDraw before minting", function () {
    expect(activeDrawFundingError("cusdc", 5n, 1_700_000_000n, 20_000_000n)).to.include("draw 5 is still active");
    expect(activeDrawFundingError("cusdc", 5n, 1_700_000_000n, 20_000_000n)).to.include("PRIZE_FUNDING_UNITS=20000000");
  });
});
