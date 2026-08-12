-- BOTGUARD off-chain database schema
-- PostgreSQL 15+. Designed for read-heavy access (credential status checks)
-- with a small, bursty write path (verification submissions).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Issuers mirrors IssuerRegistry.sol on-chain state for fast off-chain lookups.
-- The chain remains the source of truth; this table is a synced read cache
-- kept current by the chain-indexer service (see ARCHITECTURE section 5).
-- ---------------------------------------------------------------------------
CREATE TABLE issuers (
    issuer_address      CHAR(42)     PRIMARY KEY,
    name                TEXT         NOT NULL,
    trust_tier          SMALLINT     NOT NULL CHECK (trust_tier BETWEEN 1 AND 3),
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    registered_at       TIMESTAMPTZ  NOT NULL,
    revoked_at          TIMESTAMPTZ,
    last_synced_block   BIGINT       NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Verification requests: the off-chain workflow state machine. Nothing here
-- is a compliance record by itself, it is queue and processing metadata.
-- Status: PENDING -> IN_REVIEW -> SIGNED -> SUBMITTED -> CONFIRMED | FAILED
-- ---------------------------------------------------------------------------
CREATE TABLE verification_requests (
    request_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_address       CHAR(42)     NOT NULL,
    issuer_address       CHAR(42)     NOT NULL REFERENCES issuers(issuer_address),
    status               TEXT         NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','IN_REVIEW','SIGNED','SUBMITTED','CONFIRMED','FAILED')),
    requested_tier        SMALLINT     NOT NULL,   -- maps to InvestorTier enum
    jurisdiction          CHAR(2),
    commitment_hash       CHAR(66),                 -- 0x + 64 hex chars, set once signed
    tx_hash               CHAR(66),
    submitted_at          TIMESTAMPTZ,
    confirmed_at          TIMESTAMPTZ,
    retry_count            SMALLINT     NOT NULL DEFAULT 0,
    failure_reason         TEXT,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_holder ON verification_requests (holder_address);
CREATE INDEX idx_verification_status ON verification_requests (status) WHERE status NOT IN ('CONFIRMED','FAILED');

-- ---------------------------------------------------------------------------
-- Off-chain verification evidence store. Stores ONLY encrypted references
-- (e.g. S3/IPFS object keys with client-side encryption), never raw KYC
-- documents in the database itself. commitment_hash on-chain must equal
-- keccak256(canonical_json(evidence_pointer, verified_at, verifier_notes_hash)).
-- ---------------------------------------------------------------------------
CREATE TABLE verification_evidence (
    request_id           UUID         PRIMARY KEY REFERENCES verification_requests(request_id),
    encrypted_pointer     TEXT         NOT NULL,   -- pointer to encrypted evidence blob
    evidence_hash         CHAR(66)     NOT NULL,
    verifier_notes_hash   CHAR(66),
    retention_expires_at  TIMESTAMPTZ  NOT NULL     -- enforced purge date per data retention policy
);

-- ---------------------------------------------------------------------------
-- Credential read cache, synced from CredentialRegistry.sol events.
-- This is what the query API actually reads from; it never reads the chain
-- synchronously on the hot path.
-- ---------------------------------------------------------------------------
CREATE TABLE credentials_cache (
    holder_address        CHAR(42)     PRIMARY KEY,
    tier                   SMALLINT     NOT NULL,
    jurisdiction            CHAR(2),
    issuer_address           CHAR(42)     NOT NULL,
    issued_at                TIMESTAMPTZ  NOT NULL,
    expires_at                TIMESTAMPTZ  NOT NULL,
    revoked                   BOOLEAN      NOT NULL DEFAULT FALSE,
    revocation_reason          TEXT,
    last_synced_block           BIGINT       NOT NULL,
    last_synced_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_credentials_expiry ON credentials_cache (expires_at) WHERE revoked = FALSE;

-- ---------------------------------------------------------------------------
-- Monitoring agent flags: append-only log of anomalous pattern detections.
-- A flag does not itself revoke; it is reviewed (auto or human) then may
-- trigger a revokeCredential call, logged separately in audit_log.
-- ---------------------------------------------------------------------------
CREATE TABLE monitor_flags (
    flag_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_address          CHAR(42)     NOT NULL,
    flag_type                TEXT         NOT NULL,  -- e.g. STRUCTURING, RAPID_FRAGMENTATION, TIER_MISMATCH
    severity                  SMALLINT     NOT NULL CHECK (severity BETWEEN 1 AND 5),
    detail_json                JSONB        NOT NULL,
    auto_action_taken            TEXT,                  -- NULL, 'REVOKED', 'HELD', 'ESCALATED'
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_at                     TIMESTAMPTZ,
    reviewed_by                       TEXT
);

CREATE INDEX idx_monitor_flags_holder ON monitor_flags (holder_address);
CREATE INDEX idx_monitor_flags_unreviewed ON monitor_flags (created_at) WHERE reviewed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Append-only audit log. Every state-changing action, on-chain or off, is
-- recorded here with enough context to reconstruct "why" a decision was made.
-- This table is never updated or deleted from, only inserted into.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    log_id                 BIGSERIAL    PRIMARY KEY,
    actor_address            CHAR(42),
    actor_type                TEXT         NOT NULL,  -- 'ISSUER','GOVERNANCE','MONITOR','SYSTEM'
    action                      TEXT         NOT NULL,  -- 'ISSUE','REVOKE','RENEW','FLAG','ISSUER_ADDED', etc
    holder_address                CHAR(42),
    tx_hash                        CHAR(66),
    detail_json                      JSONB,
    created_at                        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_holder ON audit_log (holder_address);
CREATE INDEX idx_audit_created ON audit_log (created_at);

-- ---------------------------------------------------------------------------
-- Rate limiting ledger, backs the API gateway's per-issuer and per-IP throttling.
-- A lightweight table mirrored into Redis for hot-path checks; Postgres row is
-- the durable fallback if Redis is cold-started.
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limit_windows (
    key                       TEXT         NOT NULL,   -- e.g. 'issuer:0xabc...' or 'ip:1.2.3.4'
    window_start                TIMESTAMPTZ  NOT NULL,
    request_count                  INTEGER      NOT NULL DEFAULT 0,
    PRIMARY KEY (key, window_start)
);
