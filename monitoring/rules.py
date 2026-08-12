"""
BOTGUARD monitoring agent, rule layer.

Watches indexed on-chain activity (transfers, staking, lending actions) for
wallets holding an active credential and raises flags when behavior is
inconsistent with the declared investor tier or looks like structuring.

This module is intentionally rule-based and auditable rather than a black
box model. Every flag records which rule fired and why, since an
unexplainable auto-revocation is a liability, not a feature, in a
compliance product. A statistical/ML layer can sit on top of this later,
but the rule layer is what should ever be allowed to trigger an on-chain
revocation directly.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class WalletActivityWindow:
    holder_address: str
    declared_tier: str
    transfers_last_24h: int
    total_value_last_24h: float
    distinct_counterparties_last_24h: int
    largest_single_transfer: float
    account_age_days: int


@dataclass
class Flag:
    holder_address: str
    flag_type: str
    severity: int
    detail: dict
    recommended_action: str  # 'NONE', 'HOLD', 'ESCALATE', 'AUTO_REVOKE'


# Structuring: many transfers just under a threshold in a short window,
# a classic pattern for evading a per-transaction reporting trigger.
STRUCTURING_TRANSFER_COUNT_THRESHOLD = 8
STRUCTURING_WINDOW_HOURS = 24

# Rapid fragmentation: a holder spreading a position across many distinct
# addresses fast, often used to launder provenance or dodge a per-wallet cap.
FRAGMENTATION_COUNTERPARTY_THRESHOLD = 6

# Tier mismatch: a RETAIL-tier holder transacting at INSTITUTIONAL-scale value.
TIER_VALUE_CEILINGS = {
    "RETAIL": 25_000.0,
    "ACCREDITED": 250_000.0,
    "INSTITUTIONAL": float("inf"),
}

# New account moving disproportionate value very quickly.
VELOCITY_NEW_ACCOUNT_DAYS = 3
VELOCITY_NEW_ACCOUNT_VALUE_CEILING = 50_000.0


def evaluate(window: WalletActivityWindow) -> list[Flag]:
    flags: list[Flag] = []

    if window.transfers_last_24h >= STRUCTURING_TRANSFER_COUNT_THRESHOLD:
        flags.append(Flag(
            holder_address=window.holder_address,
            flag_type="STRUCTURING",
            severity=3,
            detail={
                "transfers_last_24h": window.transfers_last_24h,
                "threshold": STRUCTURING_TRANSFER_COUNT_THRESHOLD,
            },
            recommended_action="ESCALATE",
        ))

    if window.distinct_counterparties_last_24h >= FRAGMENTATION_COUNTERPARTY_THRESHOLD:
        flags.append(Flag(
            holder_address=window.holder_address,
            flag_type="RAPID_FRAGMENTATION",
            severity=3,
            detail={
                "distinct_counterparties": window.distinct_counterparties_last_24h,
                "threshold": FRAGMENTATION_COUNTERPARTY_THRESHOLD,
            },
            recommended_action="ESCALATE",
        ))

    ceiling = TIER_VALUE_CEILINGS.get(window.declared_tier, 0.0)
    if window.total_value_last_24h > ceiling:
        flags.append(Flag(
            holder_address=window.holder_address,
            flag_type="TIER_MISMATCH",
            severity=4,
            detail={
                "declared_tier": window.declared_tier,
                "value_moved_24h": window.total_value_last_24h,
                "tier_ceiling": ceiling,
            },
            # Tier mismatch alone holds pending re-verification, it does not
            # auto-revoke, since it may simply mean the holder should be
            # upgraded rather than punished.
            recommended_action="HOLD",
        ))

    if (window.account_age_days <= VELOCITY_NEW_ACCOUNT_DAYS
            and window.total_value_last_24h > VELOCITY_NEW_ACCOUNT_VALUE_CEILING):
        flags.append(Flag(
            holder_address=window.holder_address,
            flag_type="VELOCITY_ANOMALY",
            severity=5,
            detail={
                "account_age_days": window.account_age_days,
                "value_moved_24h": window.total_value_last_24h,
            },
            # New account, large fast value movement: highest severity,
            # eligible for automatic hold pending human review, never an
            # unreviewed auto-revoke on a single rule firing.
            recommended_action="ESCALATE",
        ))

    return flags


def decide_action(flags: list[Flag]) -> str:
    """
    Aggregates flags from a single evaluation pass into one action.
    AUTO_REVOKE is deliberately unreachable from a single rule firing,
    it requires two independent high-severity flags corroborating each
    other, so one noisy heuristic can never unilaterally cut off a holder.
    """
    high_severity = [f for f in flags if f.severity >= 4]
    if len(high_severity) >= 2:
        return "AUTO_REVOKE"
    if any(f.recommended_action == "ESCALATE" for f in flags):
        return "ESCALATE"
    if any(f.recommended_action == "HOLD" for f in flags):
        return "HOLD"
    return "NONE"
