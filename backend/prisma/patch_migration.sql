-- Patch: add Plan/UserPlan tables, planTier column, missing LedgerType values
-- Safe to run multiple times (all statements are idempotent)

-- 1. New LedgerType enum values
DO $$ BEGIN
  ALTER TYPE "LedgerType" ADD VALUE 'REFERRAL_PLAN_BONUS';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "LedgerType" ADD VALUE 'PLAN_PURCHASE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. planTier column on Task
DO $$ BEGIN
  ALTER TABLE "Task" ADD COLUMN "planTier" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 3. Plan table
CREATE TABLE IF NOT EXISTS "Plan" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  "durationDays" INTEGER NOT NULL DEFAULT 30,
  "maxEarnings" DECIMAL(12,2),
  features JSONB NOT NULL DEFAULT '[]',
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- 4. UserPlanStatus enum
DO $$ BEGIN
  CREATE TYPE "UserPlanStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. UserPlan table
CREATE TABLE IF NOT EXISTS "UserPlan" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "planId" UUID NOT NULL REFERENCES "Plan"(id),
  "amountPaid" DECIMAL(10,2) NOT NULL,
  status "UserPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP NOT NULL DEFAULT now(),
  "endDate" TIMESTAMP NOT NULL,
  "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "UserPlan_userId_idx" ON "UserPlan" ("userId");
CREATE INDEX IF NOT EXISTS "UserPlan_planId_idx" ON "UserPlan" ("planId");
