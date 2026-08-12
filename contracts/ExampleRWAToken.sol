// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ComplianceGate} from "./ComplianceGate.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";

/// @title ExampleRWAToken
/// @notice Reference integration only, demonstrates how a fractional real-estate share
///         token gates transfers through BOTGUARD. Not the RentyVest production contract.
contract ExampleRWAToken is ERC20, ComplianceGate {
    address public immutable minter;

    constructor(
        string memory name_,
        string memory symbol_,
        address botguardAddress
    )
        ERC20(name_, symbol_)
        ComplianceGate(
            botguardAddress,
            CredentialRegistry.InvestorTier.RETAIL,
            false,
            bytes2(0)
        )
    {
        // Needed for local demo / test minting; production RWA tokens use their own issuance flow.
        minter = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "Not minter");
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount)
        public
        override
        onlyCompliant(msg.sender)
        onlyCompliant(to)
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        override
        onlyCompliant(from)
        onlyCompliant(to)
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }
}
