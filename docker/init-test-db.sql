-- Runs once, the first time the Postgres data volume is created. Provisions
-- a separate database for integration tests so `pnpm test` never touches
-- the dev/seed database.
CREATE DATABASE clipping_marketplace_test;
