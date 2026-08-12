// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IssuerRegistry} from "./IssuerRegistry.sol";

/// @title CredentialRegistry
/// @notice Stores compliance credentials as hashed commitments, not raw identity data.
///         Credentials are tiered (investor category) and jurisdiction-scoped, carry an
///         expiry, and can be revoked by the issuing party or by an automated monitor.
contract CredentialRegistry {
    IssuerRegistry public immutable issuerRegistry;

    /// @dev InvestorTier is intentionally coarse. Fine-grained data never touches chain.
    enum InvestorTier {
        NONE,
        RETAIL,
        ACCREDITED,
        INSTITUTIONAL
    }

    struct Credential {
        bytes32 commitmentHash;   // hash of off-chain verification record (issuer-signed)
        InvestorTier tier;
        bytes2 jurisdiction;      // ISO 3166-1 alpha-2, e.g. "NG", "US"
        address issuer;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
        bytes32 revocationReason; // short code, e.g. "MONITOR_FLAG", "USER_REQUEST", "ISSUER_ERROR"
    }

    // holder => credential
    mapping(address => Credential) public credentials;

    // addresses permitted to trigger automated revocation (the monitoring agent's relay)
    mapping(address => bool) public monitors;
    address public governance;

    // ------------------------------------------------------------------
    // Verification fee escrow. A wallet pays `verificationFee` up front to
    // request verification. The payment event is deliberately minimal, no
    // tier or jurisdiction is emitted, only the fact that this address has
    // an escrowed payment, so a chain observer cannot infer what a pending
    // applicant is applying for while the application is still in review.
    // Funds settle to `treasury` only on approval (issueCredential), or
    // refund to the holder on explicit rejection, never silently kept on
    // a rejection.
    // ------------------------------------------------------------------
    uint256 public verificationFee;
    address public treasury;
    mapping(address => uint256) public escrowedFee;

    event CredentialIssued(
        address indexed holder,
        address indexed issuer,
        InvestorTier tier,
        bytes2 jurisdiction,
        uint64 expiresAt
    );
    event CredentialRevoked(address indexed holder, bytes32 reason, address indexed revokedBy);
    event CredentialRenewed(address indexed holder, uint64 newExpiresAt);
    event MonitorAuthorized(address indexed monitor);
    event MonitorRevoked(address indexed monitor);
    event VerificationFeePaid(address indexed holder, uint256 amount, uint64 timestamp);
    event FeeSettled(address indexed holder, uint256 amount, bool approved);
    event VerificationFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error NotGovernance();
    error NotActiveIssuer();
    error NotAuthorizedMonitor();
    error CredentialNotFound();
    error CredentialAlreadyRevoked();
    error InvalidExpiry();
    error NotIssuerOrGovernance();
    error IncorrectFee(uint256 sent, uint256 required);
    error FeeAlreadyEscrowed();
    error NoFeeEscrowed();
    error TreasuryTransferFailed();
    error ZeroAddress();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    modifier onlyActiveIssuer() {
        if (!issuerRegistry.isActiveIssuer(msg.sender)) revert NotActiveIssuer();
        _;
    }

    constructor(address _issuerRegistry, address _governance, address _treasury, uint256 _verificationFee) {
        if (_treasury == address(0)) revert ZeroAddress();
        issuerRegistry = IssuerRegistry(_issuerRegistry);
        governance = _governance;
        treasury = _treasury;
        verificationFee = _verificationFee; // e.g. 0.5 * 10**18 for 0.5 BOT on an 18-decimal chain
    }

    /// @notice Holder-initiated first step. The wallet being verified pays the fee itself,
    ///         satisfying a genuine wallet-interaction flow rather than an issuer-only one.
    ///         Emits no tier or jurisdiction, only the fact that a fee is escrowed, so the
    ///         pending application's details are not publicly inferable from this event.
    function payFeeAndRequestVerification() external payable {
        if (msg.value != verificationFee) revert IncorrectFee(msg.value, verificationFee);
        if (escrowedFee[msg.sender] != 0) revert FeeAlreadyEscrowed();

        escrowedFee[msg.sender] = msg.value;
        emit VerificationFeePaid(msg.sender, msg.value, uint64(block.timestamp));
    }

    /// @notice Issuer or governance rejects a pending application, refunding the escrowed
    ///         fee in full. A rejection is not a punitive event, the wallet paid for the
    ///         verification service to be performed, not for a guaranteed approval.
    function rejectVerification(address holder) external {
        if (msg.sender != governance && !issuerRegistry.isActiveIssuer(msg.sender)) revert NotActiveIssuer();
        uint256 fee = escrowedFee[holder];
        if (fee == 0) revert NoFeeEscrowed();

        escrowedFee[holder] = 0;
        (bool ok, ) = holder.call{value: fee}("");
        if (!ok) revert TreasuryTransferFailed();
        emit FeeSettled(holder, fee, false);
    }

    function setVerificationFee(uint256 newFee) external onlyGovernance {
        emit VerificationFeeUpdated(verificationFee, newFee);
        verificationFee = newFee;
    }

    function setTreasury(address newTreasury) external onlyGovernance {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Issues or overwrites a credential for `holder`. Only callable by an active
    ///         issuer. `commitmentHash` is keccak256 of the off-chain verification payload;
    ///         the underlying KYC data never touches the chain.
    function issueCredential(
        address holder,
        bytes32 commitmentHash,
        InvestorTier tier,
        bytes2 jurisdiction,
        uint64 validityPeriodSeconds
    ) external onlyActiveIssuer {
        if (validityPeriodSeconds == 0) revert InvalidExpiry();

        uint64 expiresAt = uint64(block.timestamp) + validityPeriodSeconds;

        credentials[holder] = Credential({
            commitmentHash: commitmentHash,
            tier: tier,
            jurisdiction: jurisdiction,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            revocationReason: bytes32(0)
        });

        emit CredentialIssued(holder, msg.sender, tier, jurisdiction, expiresAt);

        // Settle any escrowed fee to treasury now that the credential is live. Issuance
        // for a holder with no prior on-chain payment still succeeds, e.g. a fee-waived
        // institutional onboarding, or a migration path, so this never blocks issuance.
        uint256 fee = escrowedFee[holder];
        if (fee != 0) {
            escrowedFee[holder] = 0;
            (bool ok, ) = treasury.call{value: fee}("");
            if (!ok) revert TreasuryTransferFailed();
            emit FeeSettled(holder, fee, true);
        }
    }

    /// @notice Extends a credential's expiry without re-issuing, used for routine renewal
    ///         after periodic re-verification. Only the original issuer may renew.
    function renewCredential(address holder, uint64 additionalSeconds) external onlyActiveIssuer {
        Credential storage cred = credentials[holder];
        if (cred.issuedAt == 0) revert CredentialNotFound();
        if (cred.issuer != msg.sender) revert NotIssuerOrGovernance();
        if (cred.revoked) revert CredentialAlreadyRevoked();

        cred.expiresAt = uint64(block.timestamp) + additionalSeconds;
        emit CredentialRenewed(holder, cred.expiresAt);
    }

    /// @notice Revokes a credential. Callable by the original issuer, governance, or an
    ///         authorized monitor (the off-chain surveillance agent's on-chain relay).
    function revokeCredential(address holder, bytes32 reason) external {
        Credential storage cred = credentials[holder];
        if (cred.issuedAt == 0) revert CredentialNotFound();
        if (cred.revoked) revert CredentialAlreadyRevoked();

        bool authorized = msg.sender == cred.issuer ||
                           msg.sender == governance ||
                           monitors[msg.sender];
        if (!authorized) revert NotAuthorizedMonitor();

        cred.revoked = true;
        cred.revocationReason = reason;
        emit CredentialRevoked(holder, reason, msg.sender);
    }

    /// @notice The single check RWA contracts call. Returns false on missing, expired,
    ///         revoked, or issued-by-now-inactive-issuer credentials — a revoked issuer's
    ///         past attestations silently stop being honored without a mass migration.
    function isValid(address holder, InvestorTier minimumTier) external view returns (bool) {
        Credential storage cred = credentials[holder];
        if (cred.issuedAt == 0) return false;
        if (cred.revoked) return false;
        if (block.timestamp > cred.expiresAt) return false;
        if (uint8(cred.tier) < uint8(minimumTier)) return false;
        if (!issuerRegistry.isActiveIssuer(cred.issuer)) return false;
        return true;
    }

    function isValidForJurisdiction(
        address holder,
        InvestorTier minimumTier,
        bytes2 allowedJurisdiction
    ) external view returns (bool) {
        Credential storage cred = credentials[holder];
        if (cred.issuedAt == 0) return false;
        if (cred.revoked) return false;
        if (block.timestamp > cred.expiresAt) return false;
        if (uint8(cred.tier) < uint8(minimumTier)) return false;
        if (cred.jurisdiction != allowedJurisdiction) return false;
        if (!issuerRegistry.isActiveIssuer(cred.issuer)) return false;
        return true;
    }

    function authorizeMonitor(address monitor) external onlyGovernance {
        monitors[monitor] = true;
        emit MonitorAuthorized(monitor);
    }

    function revokeMonitor(address monitor) external onlyGovernance {
        monitors[monitor] = false;
        emit MonitorRevoked(monitor);
    }
}
