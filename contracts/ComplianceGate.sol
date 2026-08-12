// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CredentialRegistry} from "./CredentialRegistry.sol";

/// @title ComplianceGate
/// @notice A thin, reusable modifier contract that any RWA token on BOT Chain inherits
///         to gate transfers on BOTGUARD credential status. Kept deliberately separate
///         from CredentialRegistry so registry upgrades never require redeploying RWA
///         token contracts that already depend on it.
abstract contract ComplianceGate {
    CredentialRegistry public immutable botguard;
    CredentialRegistry.InvestorTier public immutable minimumTier;
    bool public immutable jurisdictionRestricted;
    bytes2 public immutable allowedJurisdiction;

    event ComplianceCheckFailed(address indexed account, string reason);

    error NotCompliant(address account);

    constructor(
        address _botguard,
        CredentialRegistry.InvestorTier _minimumTier,
        bool _jurisdictionRestricted,
        bytes2 _allowedJurisdiction
    ) {
        botguard = CredentialRegistry(_botguard);
        minimumTier = _minimumTier;
        jurisdictionRestricted = _jurisdictionRestricted;
        allowedJurisdiction = _allowedJurisdiction;
    }

    modifier onlyCompliant(address account) {
        if (!_isCompliant(account)) revert NotCompliant(account);
        _;
    }

    function _isCompliant(address account) internal view returns (bool) {
        if (jurisdictionRestricted) {
            return botguard.isValidForJurisdiction(account, minimumTier, allowedJurisdiction);
        }
        return botguard.isValid(account, minimumTier);
    }

    /// @dev Exposed so frontends can pre-check compliance before submitting a transfer,
    ///      avoiding a wasted gas-spent revert for a predictable failure.
    function checkCompliance(address account) external view returns (bool) {
        return _isCompliant(account);
    }
}
