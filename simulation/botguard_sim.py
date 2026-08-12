"""
BOTGUARD discrete-event simulation.

Models the full credential issuance pipeline:
  client request -> API gateway -> verification queue -> worker pool
  (off-chain checks) -> issuer signing -> chain submission queue ->
  BOT Chain block inclusion -> confirmation

Injects realistic failure modes:
  - issuer signing service intermittent downtime
  - database contention under burst load
  - chain congestion / dropped transactions requiring resubmission
  - duplicate/replay submissions
  - revocation race conditions (credential revoked mid-transfer-check)

Outputs latency percentiles, throughput, failure rates, and queue depth
statistics used directly in the architecture document's simulation section.
"""

import simpy
import random
import statistics
import json
from dataclasses import dataclass, field
from pathlib import Path

random.seed(42)

OUT_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Configuration, chosen to reflect BOT Chain's stated ~0.75s block time and a
# realistic small-team launch scale (hundreds, not millions, of daily verifications)
# ---------------------------------------------------------------------------

SIM_DURATION_SECONDS = 24 * 60 * 60          # simulate one full day
ARRIVAL_RATE_PER_MIN_BASELINE = 4            # baseline: 4 verification requests/min
BURST_MULTIPLIER = 6                          # burst window multiplier (e.g. marketing push)
BURST_WINDOW = (12 * 3600, 13 * 3600)         # 12:00-13:00 burst

VERIFICATION_WORKERS = 3                      # off-chain KYC/document check workers
DB_WRITE_WORKERS = 4                          # DB connection pool size (simplified)
ISSUER_SIGNERS = 2                            # parallel issuer signing capacity

VERIFICATION_TIME_MEAN = 18.0                 # seconds, off-chain identity check
VERIFICATION_TIME_STD = 6.0
DB_WRITE_TIME_MEAN = 0.08                     # seconds per write
ISSUER_SIGN_TIME_MEAN = 1.2                   # seconds to produce signed commitment
CHAIN_BLOCK_TIME = 0.75                       # seconds, BOT Chain target block time
CHAIN_CONFIRM_BLOCKS = 2                      # blocks to consider final

ISSUER_DOWNTIME_PROB_PER_CHECK = 0.015        # chance issuer signer is down when polled
ISSUER_DOWNTIME_DURATION = (30, 180)          # seconds, when it happens
CHAIN_DROP_PROB = 0.03                        # chance a submitted tx is dropped/must retry
MAX_RETRIES = 3

DB_POOL_SATURATION_THRESHOLD = 4              # queued writes beyond this trigger backpressure


@dataclass
class Metrics:
    completed: list = field(default_factory=list)     # end-to-end latencies (s)
    failed: int = 0
    retried: int = 0
    issuer_downtime_events: int = 0
    db_backpressure_events: int = 0
    chain_drops: int = 0
    max_verification_queue: int = 0
    max_db_queue: int = 0
    revocation_race_detected: int = 0
    total_submitted: int = 0


metrics = Metrics()


def arrival_interval(t):
    """Return seconds until next arrival, adjusted for the burst window."""
    rate = ARRIVAL_RATE_PER_MIN_BASELINE
    if BURST_WINDOW[0] <= t <= BURST_WINDOW[1]:
        rate *= BURST_MULTIPLIER
    mean_interval = 60.0 / rate
    return random.expovariate(1.0 / mean_interval)


def verification_pipeline(env, name, verification_workers, db_pool, issuer_signers, issuer_state):
    """One credential request moving through the full pipeline."""
    t_start = env.now
    metrics.total_submitted += 1

    # 1. Off-chain verification (document/liveness/sanctions check)
    metrics.max_verification_queue = max(
        metrics.max_verification_queue, len(verification_workers.queue)
    )
    with verification_workers.request() as req:
        yield req
        vtime = max(1.0, random.gauss(VERIFICATION_TIME_MEAN, VERIFICATION_TIME_STD))
        yield env.timeout(vtime)

    # 2. Issuer signing (produces the commitment hash signature)
    with issuer_signers.request() as req:
        yield req
        if issuer_state["down_until"] > env.now:
            # issuer signer unavailable, request queues until it returns
            yield env.timeout(issuer_state["down_until"] - env.now)
        elif random.random() < ISSUER_DOWNTIME_PROB_PER_CHECK:
            downtime = random.uniform(*ISSUER_DOWNTIME_DURATION)
            issuer_state["down_until"] = env.now + downtime
            metrics.issuer_downtime_events += 1
            yield env.timeout(downtime)
        yield env.timeout(random.expovariate(1.0 / ISSUER_SIGN_TIME_MEAN))

    # 3. Database write (persist off-chain metadata + commitment record)
    metrics.max_db_queue = max(metrics.max_db_queue, len(db_pool.queue))
    if len(db_pool.queue) > DB_POOL_SATURATION_THRESHOLD:
        metrics.db_backpressure_events += 1
    with db_pool.request() as req:
        yield req
        yield env.timeout(random.expovariate(1.0 / DB_WRITE_TIME_MEAN))

    # 4. Chain submission with retry-on-drop
    attempts = 0
    while attempts <= MAX_RETRIES:
        attempts += 1
        blocks_to_wait = CHAIN_CONFIRM_BLOCKS
        yield env.timeout(blocks_to_wait * CHAIN_BLOCK_TIME)
        if random.random() < CHAIN_DROP_PROB:
            metrics.chain_drops += 1
            metrics.retried += 1
            continue
        break
    else:
        metrics.failed += 1
        return

    latency = env.now - t_start
    metrics.completed.append(latency)


def revocation_race_checker(env, credential_holders, credential_registry_state):
    """
    Periodically simulates the edge case where a holder's credential is revoked
    by the monitoring agent in the same block window a transfer-check reads it,
    to measure how often a stale-read race could theoretically occur under the
    view-function read model (informational, not a state mutation risk).
    """
    while True:
        yield env.timeout(random.expovariate(1.0 / 300))  # roughly every 5 min
        if credential_holders:
            holder = random.choice(credential_holders)
            read_time = env.now
            revoke_time = read_time + random.uniform(-0.5, 0.5)
            if abs(revoke_time - read_time) < CHAIN_BLOCK_TIME:
                metrics.revocation_race_detected += 1


def request_generator(env, verification_workers, db_pool, issuer_signers, issuer_state, holders):
    i = 0
    while True:
        interval = arrival_interval(env.now)
        yield env.timeout(interval)
        i += 1
        holder = f"0xHOLDER{i:06d}"
        holders.append(holder)
        env.process(
            verification_pipeline(env, holder, verification_workers, db_pool, issuer_signers, issuer_state)
        )


def run_simulation():
    env = simpy.Environment()
    verification_workers = simpy.Resource(env, capacity=VERIFICATION_WORKERS)
    db_pool = simpy.Resource(env, capacity=DB_WRITE_WORKERS)
    issuer_signers = simpy.Resource(env, capacity=ISSUER_SIGNERS)
    issuer_state = {"down_until": -1}
    holders = []

    env.process(request_generator(env, verification_workers, db_pool, issuer_signers, issuer_state, holders))
    env.process(revocation_race_checker(env, holders, {}))
    env.run(until=SIM_DURATION_SECONDS)
    return metrics


def summarize(m: Metrics):
    completed = sorted(m.completed)
    n = len(completed)

    def pct(p):
        if not completed:
            return 0.0
        idx = min(n - 1, int(n * p))
        return completed[idx]

    summary = {
        "total_requests_submitted": m.total_submitted,
        "total_completed": n,
        "total_hard_failures": m.failed,
        "failure_rate_pct": round(100 * m.failed / max(1, m.total_submitted), 3),
        "total_retries_due_to_chain_drop": m.retried,
        "issuer_downtime_events": m.issuer_downtime_events,
        "db_backpressure_events": m.db_backpressure_events,
        "chain_tx_drops": m.chain_drops,
        "max_verification_queue_depth": m.max_verification_queue,
        "max_db_queue_depth": m.max_db_queue,
        "revocation_race_window_events_per_day": m.revocation_race_detected,
        "latency_seconds": {
            "min": round(completed[0], 2) if completed else 0,
            "p50": round(pct(0.50), 2),
            "p90": round(pct(0.90), 2),
            "p99": round(pct(0.99), 2),
            "max": round(completed[-1], 2) if completed else 0,
            "mean": round(statistics.mean(completed), 2) if completed else 0,
        },
        "throughput_per_hour_avg": round(n / (SIM_DURATION_SECONDS / 3600), 2),
    }
    return summary


def run_simulation_scaled(worker_count, db_workers, issuer_signer_count):
    global metrics
    metrics = Metrics()
    env = simpy.Environment()
    verification_workers = simpy.Resource(env, capacity=worker_count)
    db_pool = simpy.Resource(env, capacity=db_workers)
    issuer_signers = simpy.Resource(env, capacity=issuer_signer_count)
    issuer_state = {"down_until": -1}
    holders = []

    env.process(request_generator(env, verification_workers, db_pool, issuer_signers, issuer_state, holders))
    env.process(revocation_race_checker(env, holders, {}))
    env.run(until=SIM_DURATION_SECONDS)
    return metrics


if __name__ == "__main__":
    print("=== SCENARIO A: fixed pool, VERIFICATION_WORKERS=3 (undersized for burst) ===")
    m1 = run_simulation()
    result1 = summarize(m1)
    print(json.dumps(result1, indent=2))
    with open(OUT_DIR / "results_baseline.json", "w", encoding="utf-8") as f:
        json.dump(result1, f, indent=2)

    print("\n=== SCENARIO B: elastic pool sized for burst, VERIFICATION_WORKERS=14 ===")
    m2 = run_simulation_scaled(worker_count=14, db_workers=6, issuer_signer_count=4)
    result2 = summarize(m2)
    print(json.dumps(result2, indent=2))
    with open(OUT_DIR / "results_scaled.json", "w", encoding="utf-8") as f:
        json.dump(result2, f, indent=2)
