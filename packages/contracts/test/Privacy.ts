import { expect } from "chai";
import { artifacts } from "hardhat";

describe("privacy surface", function () {
  it("does not expose amount fields in protocol events", async function () {
    for (const contract of ["ConfidentialVault", "TicketEngine", "PrizePool", "DrawManager", "VaultRegistry"]) {
      const artifact = await artifacts.readArtifact(contract);
      const events = artifact.abi.filter((item) => item.type === "event");
      for (const event of events) {
        const inputs = (event.inputs ?? []) as Array<{ name: string }>;
        const names = inputs.map((input) => input.name.toLowerCase());
        for (const forbidden of ["amount", "value", "balance", "prizeamount"]) {
          expect(names, `${contract}.${event.name}`).not.to.include(forbidden);
        }
      }
    }
  });
});
