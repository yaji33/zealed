// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/**
 * @title MockERC7984
 * @notice Mintable ERC-7984 token for local Hardhat mock-FHE tests (stands in for cUSDC).
 */
contract MockERC7984 is ZamaEthereumConfig, ERC7984 {
    constructor() ERC7984("Mock Confidential USDC", "cUSDC", "https://zealed.local/cusdc") {}

    /**
     * @notice Mints a cleartext amount to `to` as an encrypted balance (test helper only).
     * @param to Recipient of the minted confidential tokens.
     * @param amount Cleartext amount to mint (encoded as euint64).
     */
    function mint(address to, uint64 amount) external {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(to, encryptedAmount);
    }
}
