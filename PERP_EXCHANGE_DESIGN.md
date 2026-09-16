# Perpetual Exchange Design Reference

Everything researched and designed across conversations — Trendle analysis, pool mechanics, zero-sum theory, schema, race conditions, liquidation, funding rates, and build plan.

---

## Table of Contents

1. [What a Perpetual Exchange Actually Is](#1-what-a-perpetual-exchange-actually-is)
2. [vAMM vs Pooled Liquidity vs Order Book](#2-vamm-vs-pooled-liquidity-vs-order-book)
3. [Why vAMM Is Wrong for This Product](#3-why-vamm-is-wrong-for-this-product)
4. [The Trendle Model — How It Actually Works](#4-the-trendle-model--how-it-actually-works)
5. [Zero-Sum Game Theory](#5-zero-sum-game-theory)
6. [The Payout Cap — What It Is and Why It Exists](#6-the-payout-cap--what-it-is-and-why-it-exists)
7. [Funding Rate Mechanism](#7-funding-rate-mechanism)
8. [One-Sided Markets — The Real Problem](#8-one-sided-markets--the-real-problem)
9. [Liquidation Engine](#9-liquidation-engine)
10. [Pool Solvency and Zero Insolvency Design](#10-pool-solvency-and-zero-insolvency-design)
11. [Schema Design](#11-schema-design)
12. [Race Conditions and How to Solve Them](#12-race-conditions-and-how-to-solve-them)
13. [Redis and Postgres — What Goes Where](#13-redis-and-postgres--what-goes-where)
14. [Full Trade Lifecycle Simulation](#14-full-trade-lifecycle-simulation)
15. [Build Plan and Timeline](#15-build-plan-and-timeline)

---

## 1. What a Perpetual Exchange Actually Is

A perpetual futures contract is a derivative that lets users take leveraged long or short positions on an asset with no expiry date. Unlike traditional futures, positions stay open indefinitely — the funding rate mechanism keeps the mark price anchored to the underlying index price.

Key terms:

- **Index price** — the underlying real-world value. For this product: Spotify stream score.
- **Mark price** — the price used for PnL and liquidation calculations. In pooled model = index price directly.
- **Funding rate** — periodic payment between longs and shorts that anchors mark to index.
- **Leverage** — multiplier on notional exposure relative to collateral deposited.
- **Initial margin** — collateral locked to open a position.
- **Maintenance margin** — minimum collateral required to keep a position open. Breach triggers liquidation.
- **Liquidation price** — the index price at which a position's collateral falls below maintenance margin.
- **Open interest (OI)** — total notional value of all open positions on one side.

---

## 2. vAMM vs Pooled Liquidity vs Order Book

### Order Book
Users post buy and sell limit orders. A matching engine pairs them. Requires counterparties — if nobody is selling, nobody can buy. Cannot launch with zero users because there is no liquidity at genesis.

**Not suitable** for a new product with no existing user base.

### Virtual AMM (vAMM)
Uses the constant product formula `x × y = k`. Mark price = `quote_reserve / base_reserve`. Trades directly against the virtual pool — no counterparty needed. First user can trade on day one.

Problems:
- Mark price is determined by trade flow, not by the real index. If everyone longs, mark price rises even if the index is falling. This creates a persistent divergence between mark and index.
- Price impact is baked in. Large trades move the price significantly.
- Setting the initial `k` value is non-trivial. Too low = one whale moves price 80%. Too high = no price discovery.
- In a one-sided market, mark price completely disconnects from index. Funding rate has no teeth when there are no shorts to receive it.

**Not suitable** when you already have a reliable external index (stream scores).

### Pooled Liquidity (Trendle Model)
LP deposits back a single shared pool. The pool is the counterparty to every trade. Mark price = oracle index price directly. No vAMM, no order book.

- Any market can launch instantly — no individual liquidity bootstrapping per artist.
- Mark price is always the real index — no divergence possible through trading.
- Pool absorbs directional imbalance and is compensated via imbalance fees and funding surplus.

**This is the correct model** for a streaming score perpetual exchange.

---

## 3. Why vAMM Is Wrong for This Product

The streaming score is the index. It is determined externally (Spotify API) and cannot be influenced by trading activity on this platform. This means:

- You already have the answer to "where does mark price come from" — it's the stream score.
- A vAMM would create a second, competing price that diverges from the real one.
- The entire point of the product is to speculate on whether a real metric goes up or down. Using a vAMM would make the product speculate on trading flow instead.

**Mark price = stream score. Done. No vAMM needed.**

This eliminates one of the most complex components of the build (Phase 2 in the original plan — 3 weeks of work removed).

---

## 4. The Trendle Model — How It Actually Works

Trendle (trendle.fi) is the closest public reference for this product. It trades "attention indexes" derived from social media engagement (X, Reddit, YouTube) using a pooled liquidity model.

### Architecture

Three contracts / services:

1. **PriceFeed (Oracle)** — posts current index values every minute. Uses TWAP and staleness protection.
2. **Pool** — holds LP reserves, tracks `totalReserve`, `lockedReserve`, enforces minimum free reserve.
3. **Trading Engine** — manages positions, PnL, funding, fees, liquidation.

### One Pool for All Markets

All markets (every artist) share a single liquidity pool. This means:
- A new artist market requires zero individual liquidity — it draws from the shared pool.
- Pool utilization is spread across all markets simultaneously.
- LP capital earns fees from every market, not just one.

Risk: correlated losses. If many artists move the same direction simultaneously (label scandal, streaming platform outage), the single pool faces multiple simultaneous payouts. Mitigated by payout caps.

### Settlement Waterfall

When a position closes:
1. Trader's collateral covers their own loss first.
2. If PnL is positive, pool pays from locked reserve.
3. Protocol fees go to treasury. Treasury never covers shortfalls — it only receives fees.

### Fee Structure

**Trading fee** — fixed percentage of opening notional (collateral × leverage). Charged at open only. Goes to treasury.

**Imbalance fee** — charged only when opening on the dominant side. Discourages crowding.

```
OI ratio    Fee
< 3:2       0%
3:2         0.45%
→ 10:1      3.0%  (linear scale)
```

Key detail: Trendle seeds **$1,000 virtual dollars on each side** per market. This means at zero real volume, the ratio is 1:1 and the imbalance fee is 0%. A small market never immediately punishes its first traders with extreme fees.

**Funding fee** — continuous, per-second, charged to the dominant side. Goes to minority side. Surplus (more paid than received) goes to the LP pool.

---

## 5. Zero-Sum Game Theory

### Between Traders (Balanced Market)

In a perfectly balanced market the pool is a pass-through. No money is created or destroyed.

```
Long OI = $50,000 | Short OI = $50,000
Index goes up 10%

Longs make $5,000
Shorts lose $5,000

Pool receives $5,000 from shorts
Pool pays $5,000 to longs
Pool net = $0
```

The zero-sum is between traders. The pool just moves money from the losing side to the winning side.

### Between Traders and Pool (Imbalanced Market)

When OI is imbalanced, the pool takes on directional risk:

```
Long OI = $80,000 | Short OI = $20,000
Index goes up 10%

Longs make $8,000
Shorts lose $2,000

Pool receives $2,000 from shorts
Pool pays $8,000 to longs
Pool net = -$6,000
```

The pool lost $6,000. LPs absorbed the loss. This is why the imbalance fee exists — it charges the dominant side to compensate the pool for this directional exposure.

### Why It's Negative Sum for Traders Overall

Before any PnL is calculated, traders pay fees:
- Trading fee at open
- Imbalance fee if on dominant side
- Funding rate continuously if on dominant side

These fees leave the trader pool permanently. Traders as a group are guaranteed to lose total fees paid over time. The pool collects fees on every trade regardless of direction. This is the house edge.

### What Determines Max Profit

The payout cap. See Section 6.

---

## 6. The Payout Cap — What It Is and Why It Exists

### The Problem Without a Cap

Shorts can only lose their collateral (fixed, bounded). Longs without a cap have theoretically unlimited upside if the index goes to infinity. In a balanced market:

```
100 shorts each deposit $100 = $10,000 total collateral available
Index goes up 500%
100 longs on 10× each made $5,000 each = $500,000 total

Shorts lost $10,000
Longs want $500,000
Gap = $490,000 → must come from pool (LP money)
```

Zero-sum breaks. Longs extracted far more than shorts lost. The pool (LPs) absorbed the difference.

### The Cap Aligns Both Sides

```
maxPayoutThreshold = 5

Long  max payout = 5 × collateral_after_fees
Short max payout = 5 × collateral_after_fees

Long  max profit = 4 × collateral_after_fees
Long  max loss   = collateral_after_fees (full wipe)

Short max profit = 4 × collateral_after_fees
Short max loss   = collateral_after_fees (full wipe)
```

When both sides have equal caps and OI is balanced, the maximum possible payout from the pool is bounded. In a balanced market at cap, everything the longs can make equals everything the shorts can lose. Pool net = 0. True zero-sum between traders.

### How the Cap Interacts with Leverage

The cap is on collateral, not notional. Leverage determines how fast you reach the cap.

```
$100 collateral, 5× threshold = $500 max payout = $400 max profit

At 2×  leverage ($200 notional):  need +200% index move to hit cap
At 10× leverage ($1,000 notional): need +40%  index move to hit cap
At 20× leverage ($2,000 notional): need +20%  index move to hit cap
```

Higher leverage = cap is reached faster = position auto-closes sooner.

### Forced Take-Profit Liquidation

When payout reaches the cap, the system automatically closes the position. Not a penalty — just the ceiling. Trader receives the capped payout, pool unlocks the reserve.

### Cap for Shorts Has a Natural Floor

```
Short enters at index $50, position size 20 units
Natural max (index goes to 0): 20 × $50 = $1,000

cap_base        = collateral_after_fees × 5 = $490
cap_short_floor = entry_index × position_size = $1,000

Final cap = min($490, $1,000) = $490
```

The natural floor only matters for very large positions or very low leverage where index-to-zero produces less than `cap_base`. In practice, `cap_base` is almost always the binding constraint.

### Pool Reserve Locking

At open, the pool immediately locks the max payout amount:

```
pool.lockedReserve += max_payout
pool.freeReserve   = pool.totalReserve - pool.lockedReserve
```

If `freeReserve < max_payout` → order rejected. The pool never accepts more liability than it can cover. This is what makes zero insolvency achievable by design, not by luck.

---

## 7. Funding Rate Mechanism

### Purpose

Keep mark price (what traders trade on) anchored to index price (the real underlying). When mark diverges above index, longs pay shorts — making longing expensive and shorting profitable — pulling mark back down toward index.

For this product, mark price = index price directly (no vAMM). Funding rate is still needed to penalise crowding and balance OI.

### Trendle's Formula

```
fundingRatePerSecond = (Long OI - Short OI) × baseFundingRate / Long OI
```

Charged continuously on each position's **opening notional** (collateral × leverage at time of open, fixed).

The dominant side pays. The minority side receives. Surplus (total paid > total received, which always happens in an imbalanced market) flows to the LP pool.

### When Funding Is Zero

When Long OI = Short OI (perfectly balanced), funding rate = 0. Also when only one side exists (fully one-sided market), Trendle charges zero funding — there is no minority side to receive it.

Implication: in a one-sided market, the only cost to traders is the entry fee and imbalance fee. Funding doesn't bleed them. This is a design choice — it prevents punishing early traders in new markets.

### One-Sided Surplus Goes to Pool

When the market is one-sided and funding is charged (e.g., when a small minority exists on the other side), the dominant side pays more in total than the minority receives. The surplus flows to the pool, compensating LPs for providing capital to a risky one-sided market.

### Funding Drains Collateral

Funding is deducted from the position's remaining collateral continuously. If funding accumulates faster than the position makes PnL, the collateral depletes to zero and the position is liquidated by funding drain — even if the index is moving in the trader's favour.

This is the mechanism that makes holding a crowded position expensive over time, not just at open.

---

## 8. One-Sided Markets — The Real Problem

### The Scenario

Artist X starts losing streams. Index falls. But fans and believers keep longing. Nobody wants to short their favourite artist.

```
Index:    100 → 80 → 60 → 40  (streams collapsing)
Everyone: all long
```

In a vAMM: mark price stays elevated, disconnected from index. Funding has no teeth — no shorts to pay. Longs can hold indefinitely.

In the pooled model: mark price = index price (oracle). There is no disconnection. Longs are simply losing money as the index falls. Funding only matters for balancing, not for price discovery.

The problem is still: if everyone is long and the index crashes, all longs lose. Their collateral goes to the pool. Pool profits. This is fine.

The dangerous scenario is: everyone longs, and the index **rises**. All longs win simultaneously. Pool pays out. If OI is too large relative to pool size, pool is strained.

### Solutions

**1. Imbalance fee** — makes opening a new long progressively more expensive as OI skews. At 10:1 ratio, new longs pay 3% extra just to open. This slows crowding organically.

**2. Virtual seed** — $1,000 per side prevents ratio from being extreme at low volume. Small markets don't immediately penalise their first traders.

**3. OI cap relative to pool** — system rejects new positions if pool doesn't have enough free reserve to lock the max payout. Physically impossible to over-extend.

**4. Payout cap** — even if everyone wins, each position can only draw a bounded amount from the pool.

**5. Dynamic imbalance multiplier** — as a further guardrail: if OI imbalance exceeds X:1, raise the imbalance fee multiplier dynamically, not just linearly.

---

## 9. Liquidation Engine

### What Triggers Liquidation (Trendle's Five Conditions)

1. **Margin call** — remaining collateral drops below maintenance threshold relative to position value.
2. **Forced take-profit** — payout reaches max payout cap.
3. **Funding drain** — funding fees consume entire collateral.
4. **Index delisting** — the market is disabled.
5. **Whitelist removal** — trader loses access (admin action).

### Liquidation Price Calculation

For isolated margin:
```
Long  liquidation_price = entry_price × (1 - 1/leverage + maintenance_rate)
Short liquidation_price = entry_price × (1 + 1/leverage - maintenance_rate)
```

Bankruptcy price (where collateral = 0):
```
Long  bankruptcy_price = entry_price × (1 - 1/leverage)
Short bankruptcy_price = entry_price × (1 + 1/leverage)
```

The gap between liquidation price and bankruptcy price is the maintenance margin buffer. The liquidation engine fires before bankruptcy to give the pool a cushion.

### Liquidation Updates as Funding Pays

Every funding payment reduces the trader's remaining collateral. The liquidation price creeps toward the current index price as collateral erodes. A trader who was safe at open can become liquidatable purely through funding accumulation, even if the index didn't move.

### Process (Atomic)

```
1. Mark price update arrives
2. Load all open positions for this market from Redis
3. Snapshot mark price — use this single value for entire scan
4. For each position:
   a. Acquire distributed lock on position_id (SETNX, 5s TTL)
   b. If lock fails → skip (user is actively trading it, next tick catches it)
   c. BEGIN Postgres transaction
   d. SELECT position FOR UPDATE
   e. Recompute margin ratio against fresh price from DB
   f. If still underwater:
      - Close position at mark price
      - Compute realised PnL
      - If PnL > 0: send surplus to pool (LP profit)
      - If PnL < 0: debit insurance fund for deficit
      - INSERT liquidation record
      - UPDATE user balance
      - UPDATE pool locked/free reserve
   g. COMMIT
   h. DEL lock:position:{id}
5. Emit liquidation event
```

### Full Liquidation, Not Partial

Trendle performs full liquidation — entire position closed immediately. No partial close to try to save the position. This keeps the accounting simple and prevents the pool from holding partial exposure on an underwater position.

### When Pool Is Strained

If a position's collateral is fully wiped and PnL is still negative (bankruptcy price was passed before liquidation fired), the shortfall comes from the insurance fund. If the insurance fund is empty, trading on that market should pause. Do not socialise losses at MVP — just halt.

---

## 10. Pool Solvency and Zero Insolvency Design

### The Core Principle

**Only accept positions the pool can fully pay at the moment of opening.**

At open:
```
required_lock = collateral_after_fees × maxPayoutThreshold
if pool.freeReserve < required_lock → reject order
```

The pool always has enough to pay every open position's maximum payout because it locked that money at open. Insolvency is impossible by construction.

### Reserve States

```
totalReserve   = sum of all LP deposits (grows with fee allocation)
lockedReserve  = sum of all max_payout across all open positions
freeReserve    = totalReserve - lockedReserve
minFreeReserve = totalReserve × 0.10  (always keep 10% liquid)
```

`freeReserve` must always be ≥ `minFreeReserve`. This buffer protects against LP withdrawals shrinking free reserve while positions are open.

### LP Withdrawals

LPs can only withdraw from `freeReserve`. If `freeReserve < withdrawalAmount`, the withdrawal is queued or partially filled. LPs can never pull capital that is already locked against open positions.

### Oracle Staleness Halts New Opens

```
if last_price_update > 2 minutes ago:
    block all new position opens
    widen payout spread on existing positions
```

Stale oracle is the main attack vector. If price feeds go stale, no new exposure is accepted.

### Remaining Risks

| Risk | Mitigation |
|---|---|
| Oracle manipulation (pump stream counts briefly) | TWAP over last N data points, circuit breaker on >X% single-period move |
| LP mass withdrawal | 24h withdrawal queue, minimum lockup period |
| Code bug in settlement | Accounting invariant checks: `locked + free = total` always |
| Correlated market losses (all artists move together) | Per-market OI caps, payout caps limit per-position pool draw |

---

## 11. Schema Design

### Users Table

```sql
ALTER TABLE users ADD COLUMN available_balance  NUMERIC(20,8) NOT NULL DEFAULT 1000;
ALTER TABLE users ADD COLUMN margin_locked       NUMERIC(20,8) NOT NULL DEFAULT 0;
-- unrealized_pnl is computed at query time, not stored
-- remove single 'balance' column after migration
```

### Positions Table

```sql
CREATE TABLE positions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id),
  spotify_id          VARCHAR(255) NOT NULL,
  side                VARCHAR(5)   NOT NULL CHECK (side IN ('long','short')),
  contracts           NUMERIC(20,8) NOT NULL,          -- NOT integer, fractional allowed
  leverage            NUMERIC(5,2)  NOT NULL,
  initial_margin      NUMERIC(20,8) NOT NULL,          -- collateral locked at open
  opening_notional    NUMERIC(20,8) NOT NULL,          -- initial_margin × leverage
  entry_price         NUMERIC(20,8) NOT NULL,
  mark_price          NUMERIC(20,8) NOT NULL,          -- updated every oracle tick
  liquidation_price   NUMERIC(20,8) NOT NULL,          -- recalculated after funding
  bankruptcy_price    NUMERIC(20,8) NOT NULL,
  max_payout          NUMERIC(20,8) NOT NULL,          -- cap = initial_margin × threshold
  pool_reserve_locked NUMERIC(20,8) NOT NULL,          -- amount locked in pool for this position
  funding_paid        NUMERIC(20,8) NOT NULL DEFAULT 0,
  unrealized_pnl      NUMERIC(20,8) NOT NULL DEFAULT 0,
  mode                VARCHAR(10)   NOT NULL DEFAULT 'isolated',
  status              VARCHAR(10)   NOT NULL DEFAULT 'open',
  opened_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_positions_unique_open
  ON positions (user_id, spotify_id)
  WHERE status = 'open';
```

### Pool Table

```sql
CREATE TABLE pool (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_reserve    NUMERIC(20,8) NOT NULL DEFAULT 0,
  locked_reserve   NUMERIC(20,8) NOT NULL DEFAULT 0,
  min_free_pct     NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
-- free_reserve = total_reserve - locked_reserve (computed)
-- max_usable   = total_reserve × (1 - min_free_pct)
```

### Market State Table

```sql
ALTER TABLE artist_metrics ADD COLUMN mark_price           NUMERIC(20,8) DEFAULT 0;
ALTER TABLE artist_metrics ADD COLUMN index_price          NUMERIC(20,8) DEFAULT 0;
ALTER TABLE artist_metrics ADD COLUMN open_interest_long   NUMERIC(20,8) DEFAULT 0;
ALTER TABLE artist_metrics ADD COLUMN open_interest_short  NUMERIC(20,8) DEFAULT 0;
ALTER TABLE artist_metrics ADD COLUMN virtual_long_seed    NUMERIC(20,8) DEFAULT 1000;
ALTER TABLE artist_metrics ADD COLUMN virtual_short_seed   NUMERIC(20,8) DEFAULT 1000;
ALTER TABLE artist_metrics ADD COLUMN max_leverage         NUMERIC(5,2)  DEFAULT 10;
ALTER TABLE artist_metrics ADD COLUMN maintenance_margin_rate NUMERIC(6,4) DEFAULT 0.05;
ALTER TABLE artist_metrics ADD COLUMN current_funding_rate NUMERIC(10,6) DEFAULT 0;
ALTER TABLE artist_metrics ADD COLUMN next_funding_at      TIMESTAMPTZ;
ALTER TABLE artist_metrics ADD COLUMN payout_threshold     NUMERIC(5,2)  DEFAULT 5;
```

### Liquidations Table

```sql
CREATE TABLE liquidations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id       UUID NOT NULL REFERENCES positions(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  spotify_id        VARCHAR(255) NOT NULL,
  side              VARCHAR(5)   NOT NULL,
  contracts         NUMERIC(20,8) NOT NULL,
  entry_price       NUMERIC(20,8) NOT NULL,
  mark_price        NUMERIC(20,8) NOT NULL,
  liquidation_price NUMERIC(20,8) NOT NULL,
  bankruptcy_price  NUMERIC(20,8) NOT NULL,
  initial_margin    NUMERIC(20,8) NOT NULL,
  funding_paid      NUMERIC(20,8) NOT NULL,
  realized_pnl      NUMERIC(20,8) NOT NULL,
  insurance_used    NUMERIC(20,8) NOT NULL DEFAULT 0,
  reason            VARCHAR(30)   NOT NULL,  -- 'margin_call', 'funding_drain', 'forced_tp', 'delisted'
  liquidated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### Insurance Fund Table

```sql
CREATE TABLE insurance_fund (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  balance    NUMERIC(20,8) NOT NULL,
  delta      NUMERIC(20,8) NOT NULL,
  reason     VARCHAR(50)   NOT NULL,  -- 'liquidation_surplus', 'deficit_cover', 'fee_allocation'
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### Funding Rates Table (updated)

```sql
CREATE TABLE funding_rates (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spotify_id           VARCHAR(255) NOT NULL,
  rate                 NUMERIC(10,6) NOT NULL,
  mark_price           NUMERIC(20,8) NOT NULL,
  index_price          NUMERIC(20,8) NOT NULL,
  open_interest_long   NUMERIC(20,8) NOT NULL,
  open_interest_short  NUMERIC(20,8) NOT NULL,
  premium              NUMERIC(10,6) NOT NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## 12. Race Conditions and How to Solve Them

### The Five Races

**Race 1 — Balance**
Two simultaneous orders both pass the balance check, both deduct, balance goes negative.
Solution: `SELECT users FOR UPDATE` in every balance-touching transaction.

**Race 2 — Pool reserve**
Two simultaneous positions both read `freeReserve = $1000`, both lock $800, pool over-extended.
Solution: `SELECT pool FOR UPDATE` in every position-opening transaction.

**Race 3 — Position mutation**
Funding engine applies payment to position while user submits a close. One overwrites the other.
Solution: `SELECT positions FOR UPDATE` in every position-touching operation.

**Race 4 — Liquidation vs close**
Liquidation engine and user close order hit the same position simultaneously. Position closed twice.
Solution: `SETNX lock:position:{id} EX 5` before liquidation attempt. If lock exists, skip and catch next tick.

**Race 5 — Mark price mid-scan**
Liquidation engine is scanning 500 positions. Mark price updates mid-scan. Inconsistent boundary.
Solution: Snapshot mark price once at start of scan. Use that snapshot for all checks in that pass.

### Order Processing Flow

```
HTTP request
  → Rate limit check (Redis)
  → SETNX lock:user:{id} EX 10  (fail fast → 409)
  → BEGIN Postgres transaction
      SELECT users        FOR UPDATE
      SELECT positions    FOR UPDATE  (if exists)
      SELECT pool         FOR UPDATE
      Validate balance
      Validate pool free reserve
      Compute payout cap
      INSERT position
      UPDATE users.available_balance -= initial_margin
      UPDATE users.margin_locked     += initial_margin
      UPDATE pool.locked_reserve     += max_payout
      INSERT order record
  → COMMIT
  → Update Redis caches (mark, OI, position snapshot)
  → DEL lock:user:{id}
  → NOTIFY 'position_opened' (Postgres pub/sub)
  → Return response
```

### Safe Pattern for Redis + Postgres

```
Write Postgres first (in transaction) → then update Redis
```

Never write Redis first and async Postgres. If the server crashes between the two writes, Redis has data Postgres doesn't — money disappears.

If Redis and Postgres disagree, Postgres wins. Redis is rebuilt from Postgres on restart.

---

## 13. Redis and Postgres — What Goes Where

### Redis (hot state — microsecond reads)

| Key | Value | Purpose |
|---|---|---|
| `mark:{spotifyId}` | price | Current mark price, updated every oracle tick |
| `oi:{spotifyId}` | `{long, short}` | Open interest per market |
| `funding_rate:{spotifyId}` | rate | Current funding rate |
| `position:{userId}:{spotifyId}` | position snapshot | Fast liquidation scan |
| `pool:state` | `{total, locked, free}` | Pool reserve state |
| `lock:user:{id}` | 1, TTL 10s | Distributed lock per user |
| `lock:position:{id}` | 1, TTL 5s | Distributed lock per position |

### Postgres (source of truth — survives restarts)

Everything. Every write that hits Redis must also hit Postgres. On restart, Redis is rebuilt from Postgres.

### Why Both Are Needed

The liquidation engine checks every open position on every price tick. At 500 open positions and 60 ticks per minute, that's 30,000 position checks per minute. Postgres cannot handle this query rate with acceptable latency. Redis holds all positions in memory for millisecond-latency scans. Postgres ensures nothing is lost if Redis dies.

---

## 14. Full Trade Lifecycle Simulation

### Setup

```
Artist:              Bruno Mars
Index price:         $50
Pool total:          $100,000
Pool locked:         $40,000
Pool free:           $60,000
Long OI (real):      $20,000
Short OI (real):     $8,000
Virtual seed:        $1,000 per side
Payout threshold:    5×
Trading fee:         0.2%
Base funding:        0.01%/hour on opening notional
Maintenance margin:  5%
```

### Opening a Long

```
User input: $100 collateral, 10× leverage, long

Notional:             $100 × 10 = $1,000
Trading fee:          $1,000 × 0.2% = $2.00
Collateral net:       $100 - $2.00 = $98.00
Max payout:           $98 × 5 = $490.00
Pool locks:           $490.00

Entry price:          $50.00
Contracts:            $1,000 / $50 = 20 contracts
Liquidation price:    $50 × (1 - 1/10 + 0.05) = $47.50
Bankruptcy price:     $50 × (1 - 1/10) = $45.00

Pool state after:
  Total:   $100,000
  Locked:  $40,490
  Free:    $59,510
```

User sees immediately:
- Entry: $50.00
- Liquidation: $47.50
- Max profit: $392.00 (if index reaches take-profit level)
- Max loss: $98.00 (full collateral wipe)

### Funding Ticking

```
Effective Long OI:   $21,000 + $1,000 seed = $22,000
Effective Short OI:  $9,000  + $1,000 seed = $10,000

Rate per hour:
  = ($22,000 - $10,000) × 0.01% / $22,000
  = $12,000 × 0.0001 / $22,000
  = 0.00545%/hour

This position pays per hour:
  = $1,000 (opening notional) × 0.00545% = $0.0545/hour

After 24 hours:
  Funding paid:    $1.31
  Collateral left: $98.00 - $1.31 = $96.69
  Liquidation:     creeps slightly upward
```

### Closing at Profit (Index → $57)

```
Current index:    $57.00
Entry:            $50.00
Contracts:        20

Unrealised PnL:   20 × ($57 - $50) = +$140.00
Funding paid:     -$1.31
Net PnL:          +$138.69

Payout:
  = $98.00 + $138.69 = $236.69
  = min($236.69, $490 cap) = $236.69  ← under cap

User receives:    $236.69
Profit:           $136.69 on $100 invested (136% return)

Pool:
  Unlocks $490 reserved
  Pays out $236.69
  Retains $490 - $236.69 = $253.31 (goes back to free reserve)
  Plus $2.00 fee stays in treasury
```

### Closing at Loss (Index → $44 — Below Liquidation)

```
Index hits $47.50 (liquidation price)
Liquidation engine fires

PnL at $47.50:
  = 20 × ($47.50 - $50.00) = -$50.00
  Remaining collateral: $98.00 - $1.31 - $50.00 = $46.69

Payout to user: $46.69 (remaining collateral returned)
Pool:
  Unlocks $490
  Pays $46.69 to user
  Retains $490 - $46.69 = $443.31 → back to free reserve
  Net: pool profited from this liquidation
```

If index fell past bankruptcy price ($45.00) before liquidation engine fired:
- Collateral wiped, pool absorbs small loss from insurance fund.
- This is why maintenance margin buffer (liquidation at $47.50 not $45.00) is critical.

---

## 15. Build Plan and Timeline

### What Already Exists

- User auth, JWT, rate limiting ✅
- Basic position open/close (1× implied leverage) ✅
- Postgres + Redis + Railway infrastructure ✅
- Frontend web + Expo mobile ✅
- Spotify stream score price feed ✅
- Basic order flow ✅

### What Needs to Be Built

**Phase 1 — Schema + accounting hardening (3 weeks)**
- Split `balance` into `available_balance` + `margin_locked`
- Add leverage, liquidation_price, bankruptcy_price, initial_margin, max_payout, pool_reserve_locked to positions
- Change `contracts` from INTEGER to NUMERIC
- Add `pool`, `liquidations`, `insurance_fund` tables
- Add market state columns to `artist_metrics`
- Refactor every balance/position mutation to use `SELECT FOR UPDATE`
- Add Redis `SETNX` distributed lock per user
- Update accounting tests to cover all leverage scenarios

**Phase 2 — Leverage + payout cap system (2 weeks)**
- Allow users to select leverage (1×, 2×, 5×, 10×)
- Compute liquidation_price and bankruptcy_price at open
- Compute max_payout = collateral_after_fees × threshold
- Enforce pool free reserve check before accepting order
- Pool reserve lock/unlock on open/close
- Show liquidation price in UI

**Phase 3 — Liquidation engine (3 weeks)**
- Separate Node.js process, always running
- Subscribes to mark price updates via Postgres `LISTEN/NOTIFY`
- Loads all open positions for updated market from Redis
- Checks margin ratio using snapshot price
- Atomic Postgres transaction for each liquidation
- Insurance fund accounting (surplus and deficit)
- Full test suite: concurrent liquidation + close, funding drain liquidation, underwater liquidation

**Phase 4 — Funding rate engine (2 weeks)**
- Per-market TWAP of index price (rolling average from Redis sorted set)
- Hourly computation: `rate = clamp((long_oi - short_oi) × base_rate / long_oi, bounds)`
- Virtual $1,000 seed per side in OI ratio calculation
- Single Postgres transaction per market: debit dominant side, credit minority, surplus to pool
- Update `position.funding_paid` and recompute `liquidation_price` after each payment
- Re-trigger liquidation scan after funding application

**Phase 5 — Imbalance fee (1 week)**
- Compute OI ratio at time of order: `(real_oi + 1000) / (other_oi + 1000)`
- Apply fee schedule: 0% below 3:2, linear to 3% at 10:1
- Charge from collateral at open, send to treasury
- Show user the estimated imbalance fee before confirming

**Phase 6 — Frontend updates (2 weeks)**
- Leverage selector
- Real-time payout preview (recalculates every oracle tick before confirm)
- Liquidation price display with live updates as funding accrues
- Margin ratio health indicator (green/yellow/red)
- Current funding rate + countdown to next payment
- Max profit display

**Phase 7 — Load testing + hardening (2 weeks)**
- Simulate 500+ concurrent users
- Chaos test: kill Redis mid-trade, kill API mid-order, kill liquidation engine
- Verify Redis/Postgres consistency after each crash scenario
- Accounting invariant: `sum(available_balance) + sum(margin_locked) + pool.total_reserve = constant`
- Oracle manipulation resistance testing (TWAP validation)

### Total

| Phase | Time |
|---|---|
| Schema + accounting | 3 weeks |
| Leverage + payout cap | 2 weeks |
| Liquidation engine | 3 weeks |
| Funding rate engine | 2 weeks |
| Imbalance fee | 1 week |
| Frontend | 2 weeks |
| Testing + hardening | 2 weeks |
| **Solo total** | **~15 weeks** |
| **Two devs** | **~8-9 weeks** |

### Critical Path

The liquidation engine must be production-ready before any real money. One missed liquidation on a leveraged position with real money is a real loss. Everything else can be iterated — the liquidation engine cannot.

Priority order:
1. Accounting + row locks (Phase 1) — foundation everything else sits on
2. Liquidation engine (Phase 3) — must be correct before real money
3. Insurance fund — must exist before real money
4. Everything else — can ship iteratively

---

## Key Reference: Trendle vs This Product

| Component | Trendle | This Product |
|---|---|---|
| Index source | X, Reddit, YouTube aggregated | Spotify stream scores |
| Oracle update frequency | Every minute | Per stream data refresh |
| Mark price | = Oracle DoA index | = Stream score index |
| Liquidity model | Single shared pool, LP deposits | Single shared pool, seeded initially |
| Payout cap | `maxPayoutThreshold × collateral_after_fees` | Same |
| Funding formula | `(Long OI - Short OI) × base / Long OI` | Same |
| One-sided funding | Zero charged | Zero charged |
| OI seed per market | $1,000 virtual per side | $1,000 virtual per side |
| Imbalance fee | 0% to 3% linear | Same schedule |
| Liquidation | Full position, immediate | Full position, immediate |
| Pool structure | One pool, all markets share | One pool, all markets share |

---

*Last updated: May 2026*
