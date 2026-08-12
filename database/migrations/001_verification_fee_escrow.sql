-- Migration: verification fee escrow columns
-- Additive only. Do not alter the original schema.sql baseline.

ALTER TABLE verification_requests
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_tx_hash CHAR(66),
  ADD COLUMN IF NOT EXISTS fee_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'verification_requests_fee_status_check'
  ) THEN
    ALTER TABLE verification_requests
      ADD CONSTRAINT verification_requests_fee_status_check
      CHECK (fee_status IS NULL OR fee_status IN ('ESCROWED', 'SETTLED', 'REFUNDED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verification_fee_status
  ON verification_requests (fee_status)
  WHERE fee_status IS NOT NULL;
