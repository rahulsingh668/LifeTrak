# LifeTrak database setup

## Fresh installation

Run `schema.sql`. It is the canonical schema and already contains email OTP,
idempotent expense mutations, FX-rate storage, and request throttling.

## Upgrade an existing v2 installation

1. Back up the database.
2. Confirm `002_email_otp.sql` has already been applied.
3. Run `migrations/003_reliability_security.sql` (it is safe to re-run).
4. Deploy the matching API and frontend files.

Migration 003 adds `expenses.client_mutation_id` and the `rate_limits` table.
Deploying the new API before this migration will make authentication and expense
creation fail, so the migration must be applied first.
