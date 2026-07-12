export type Role = "USER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  referralCode: string;
  balance?: string;
  currency?: string;
  coins?: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  instructions?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  source: "MANUAL" | "CPA_NETWORK";
  externalUrl?: string | null;
  rewardAmount: string;
  currency: string;
  requiresProof: boolean;
  status: "ACTIVE" | "PAUSED" | "EXPIRED";
  completedCount: number;
  maxCompletions?: number | null;
  alreadySubmitted?: boolean;
  userHasPlan?: boolean | null;
  planName?: string | null;
  taskPlanId?: string | null;
  isFreeTask?: boolean;
  createdAt: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  title?: string;
  taskTitle?: string;
  rewardAmount?: string;
  proofText?: string | null;
  proofFileUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  rewardPaid?: string | null;
  createdAt: string;
}

export interface Deposit {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  method: "EASYPAISA" | "JAZZCASH" | "BANK_TRANSFER";
  amount: string;
  senderAccountNo?: string | null;
  transactionId: string;
  screenshotUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  method: "EASYPAISA" | "JAZZCASH" | "BANK_TRANSFER";
  amount: string;
  accountName: string;
  accountNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  reviewNote?: string | null;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

export interface PaymentMethodConfig {
  id: string;
  method: "EASYPAISA" | "JAZZCASH" | "BANK_TRANSFER";
  isEnabled: boolean;
  accountName?: string | null;
  accountNumber?: string | null;
  instructions?: string | null;
}

export interface TaskCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  durationDays: number;
  maxEarnings?: string | null;
  dailyEarning?: string | null;
  maxUsers?: number | null;
  currentUsers?: number;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  logoUrl?: string | null;
  dailyTaskLimit?: number | null;
  createdAt: string;
}

export interface UserPlan {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  amountPaid: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  referralBonusPaid: boolean;
  startDate: string;
  endDate?: string | null;
  maxEarnings?: string | null;
  durationDays: number;
  features: string[];
}

export interface ReferralStats {
  referralCode: string;
  bonusRate: number;
  totalReferrals: number;
  totalBonusEarned: number;
}

export interface SpinSegment {
  id: string;
  label: string;
  rewardAmount: string;
  color: string;
  sortOrder: number;
  segmentType: "PRIZE" | "BONUS_SPIN";
}

export interface SpinInfo {
  segments: SpinSegment[];
  canSpin: boolean;
  spinsToday: number;
  secondsUntilSpin: number;
  goldSegments: SpinSegment[];
  goldSpinPrice: number;
  walletBalance: number;
}

export interface SpinResult {
  winner: { id: string; label: string; rewardAmount: string; segmentType: string };
  winnerIndex: number;
  totalSegments: number;
  secondsUntilSpin: number;
}

export interface GoldSpinResult {
  winner: { id: string; label: string; rewardAmount: string; segmentType: string };
  winnerIndex: number;
  totalSegments: number;
  walletBalance: number;
}

export interface RedeemCode {
  id: string;
  code: string;
  rewardAmount: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface MysteryBoxPrize {
  id: string;
  label: string;
  rewardAmount: string;
  weight: string;
  isActive: boolean;
  sortOrder: number;
}

export interface MysteryBoxInfo {
  prizes: MysteryBoxPrize[];
  dailyLimit: number;
  playsToday: number;
  canPlay: boolean;
  secondsUntilReset: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalDeposited: number;
  totalWithdrawn: number;
  activeTasks: number;
  pendingTaskSubmissions: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}
