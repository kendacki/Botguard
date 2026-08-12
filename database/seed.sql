-- Demo issuer for local/testnet (Hardhat account #1)
INSERT INTO issuers (issuer_address, name, trust_tier, active, registered_at)
VALUES (
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  'BOTGUARD Demo Issuer',
  1,
  TRUE,
  NOW()
)
ON CONFLICT (issuer_address) DO NOTHING;
