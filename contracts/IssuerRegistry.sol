// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IssuerRegistry
/// @notice Maintains the set of compliance issuers trusted to attest credentials on BOTGUARD.
/// @dev Ownership is held by a BOT Chain multisig in production. Issuers are added/removed
///      by governance, never by a single EOA, to avoid a single point of trust.
contract IssuerRegistry {
    address public governance;
    address public pendingGovernance;

    struct Issuer {
        bool active;
        string name;            // human readable issuer name, e.g. "Persona KYC"
        uint8 trustTier;        // 1 = self-attested, 2 = licensed KYC provider, 3 = regulated VASP
        uint64 registeredAt;
        uint64 revokedAt;       // 0 if never revoked
    }

    mapping(address => Issuer) public issuers;
    address[] public issuerList;

    event IssuerRegistered(address indexed issuer, string name, uint8 trustTier);
    event IssuerRevoked(address indexed issuer, uint64 revokedAt);
    event IssuerReinstated(address indexed issuer);
    event GovernanceTransferStarted(address indexed current, address indexed pending);
    event GovernanceTransferAccepted(address indexed newGovernance);

    error NotGovernance();
    error IssuerAlreadyRegistered();
    error IssuerNotFound();
    error InvalidTrustTier();
    error ZeroAddress();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    constructor(address _governance) {
        if (_governance == address(0)) revert ZeroAddress();
        governance = _governance;
    }

    /// @notice Registers a new compliance issuer. Governance-gated so no single
    ///         verifier can unilaterally become a trust root.
    function registerIssuer(address issuer, string calldata name, uint8 trustTier) external onlyGovernance {
        if (issuer == address(0)) revert ZeroAddress();
        if (issuers[issuer].registeredAt != 0) revert IssuerAlreadyRegistered();
        if (trustTier == 0 || trustTier > 3) revert InvalidTrustTier();

        issuers[issuer] = Issuer({
            active: true,
            name: name,
            trustTier: trustTier,
            registeredAt: uint64(block.timestamp),
            revokedAt: 0
        });
        issuerList.push(issuer);

        emit IssuerRegistered(issuer, name, trustTier);
    }

    /// @notice Revokes an issuer. Existing credentials they issued are NOT auto-invalidated;
    ///         CredentialRegistry checks issuer.active at verification time, which means a
    ///         revoked issuer's past credentials stop being honored going forward without
    ///         requiring a mass on-chain invalidation pass.
    function revokeIssuer(address issuer) external onlyGovernance {
        if (issuers[issuer].registeredAt == 0) revert IssuerNotFound();
        issuers[issuer].active = false;
        issuers[issuer].revokedAt = uint64(block.timestamp);
        emit IssuerRevoked(issuer, uint64(block.timestamp));
    }

    function reinstateIssuer(address issuer) external onlyGovernance {
        if (issuers[issuer].registeredAt == 0) revert IssuerNotFound();
        issuers[issuer].active = true;
        issuers[issuer].revokedAt = 0;
        emit IssuerReinstated(issuer);
    }

    function isActiveIssuer(address issuer) external view returns (bool) {
        return issuers[issuer].active;
    }

    function trustTierOf(address issuer) external view returns (uint8) {
        return issuers[issuer].trustTier;
    }

    function issuerCount() external view returns (uint256) {
        return issuerList.length;
    }

    /// @notice Two-step governance transfer to avoid bricking the registry on a typo'd address.
    function transferGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert ZeroAddress();
        pendingGovernance = newGovernance;
        emit GovernanceTransferStarted(governance, newGovernance);
    }

    function acceptGovernance() external {
        if (msg.sender != pendingGovernance) revert NotGovernance();
        governance = pendingGovernance;
        pendingGovernance = address(0);
        emit GovernanceTransferAccepted(governance);
    }
}
