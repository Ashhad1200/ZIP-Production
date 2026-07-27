import api from './api';

export interface MySubscription {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  nextDueDate: string | null;
  plan: {
    id: string;
    name: string;
    pricePaisa: string;
    billingCycleDays: number;
  };
}

export interface PublicBankAccount {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
  branchCode: string | null;
}

export const billingApi = {
  getMySubscription: () => api.get<{ data: MySubscription | null }>('/platform/organizations/me/subscription').then((r) => r.data.data),

  getBankAccounts: () => api.get<{ data: PublicBankAccount[] }>('/platform/bank-accounts/public').then((r) => r.data.data),

  submitPayment: (data: { amountClaimedPaisa: number; screenshotUrl: string; transactionRef?: string; bankAccountId?: string }) =>
    api.post('/platform/payments', data).then((r) => r.data.data),
};
