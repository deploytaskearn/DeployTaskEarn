-- Initial schema migration (hand-applied in sandbox; Prisma will generate
-- this automatically via `npx prisma migrate dev` on a machine with normal
-- network access). Keep this file in sync with prisma/schema.prisma if you
-- edit the schema before running a real migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'CPA_NETWORK');
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DepositMethod" AS ENUM ('EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER');
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "WithdrawalMethod" AS ENUM ('EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
CREATE TYPE "LedgerType" AS ENUM ('DEPOSIT', 'TASK_EARNING', 'REFERRAL_BONUS', 'WITHDRAWAL', 'ADMIN_ADJUSTMENT');
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  "passwordHash" TEXT NOT NULL,
  role "Role" NOT NULL DEFAULT 'USER',
  status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "emailVerifiedAt" TIMESTAMP,
  "avatarUrl" TEXT,
  "referralCode" TEXT UNIQUE NOT NULL,
  "referredById" UUID REFERENCES "User"(id),
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ON "User" ("referredById");

CREATE TABLE "Wallet" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID UNIQUE NOT NULL REFERENCES "User"(id),
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "LedgerEntry" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  type "LedgerType" NOT NULL,
  direction "LedgerDirection" NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "referenceId" TEXT,
  note TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ON "LedgerEntry" ("userId");

CREATE TABLE "TaskCategory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  "iconUrl" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "Task" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  "categoryId" UUID REFERENCES "TaskCategory"(id),
  source "TaskSource" NOT NULL DEFAULT 'MANUAL',
  "cpaNetworkName" TEXT,
  "cpaOfferId" TEXT,
  "externalUrl" TEXT,
  "rewardAmount" DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  "requiresProof" BOOLEAN NOT NULL DEFAULT true,
  "maxCompletions" INTEGER,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  status "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ON "Task" ("categoryId");
CREATE INDEX ON "Task" (source, "cpaOfferId");

CREATE TABLE "TaskSubmission" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" UUID NOT NULL REFERENCES "Task"(id),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "proofText" TEXT,
  "proofFileUrl" TEXT,
  status "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "rewardPaid" DECIMAL(10,2),
  "autoApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMP,
  UNIQUE ("taskId", "userId")
);
CREATE INDEX ON "TaskSubmission" ("taskId");
CREATE INDEX ON "TaskSubmission" ("userId");

CREATE TABLE "PaymentMethodConfig" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method "DepositMethod" UNIQUE NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "accountName" TEXT,
  "accountNumber" TEXT,
  instructions TEXT,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "Deposit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  method "DepositMethod" NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  "senderAccountNo" TEXT,
  "transactionId" TEXT NOT NULL,
  "screenshotUrl" TEXT,
  status "DepositStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMP
);
CREATE INDEX ON "Deposit" ("userId");
CREATE INDEX ON "Deposit" (status);

CREATE TABLE "Withdrawal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  method "WithdrawalMethod" NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  status "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "paidAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMP
);
CREATE INDEX ON "Withdrawal" ("userId");
CREATE INDEX ON "Withdrawal" (status);

CREATE TABLE "SiteSetting" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "BlogPost" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "ContactMessage" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);
