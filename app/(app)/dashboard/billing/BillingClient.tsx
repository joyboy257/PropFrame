'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { BuyCreditsModal } from '@/components/billing/BuyCreditsModal';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
}

interface Usage {
  used: number;
  limit: number;
  plan: string;
}

interface BillingClientProps {
  transactions: Transaction[];
  usage: Usage;
  userCredits: number;
  successCredits: number | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAmount(amount: number): { text: string; className: string } {
  if (amount >= 0) {
    return { text: `+${amount.toLocaleString()}`, className: 'text-emerald-400' };
  }
  return { text: amount.toLocaleString(), className: 'text-red-400' };
}

export function BillingClient({ transactions, usage, userCredits, successCredits }: BillingClientProps) {
  const router = useRouter();
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Strip credits_added URL param after showing success toast (using replaceState to avoid page reload)
  useEffect(() => {
    if (successCredits !== null) {
      // Use window.history.replaceState to strip the query param without page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('credits_added');
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [successCredits]);

  // Show toast on success
  useEffect(() => {
    if (successCredits !== null) {
      toast.success(`${successCredits.toLocaleString()} credits added to your account!`);
    }
  }, [successCredits]);

  // Calculate running balances (sorted by date descending)
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let runningBalance = userCredits;
  const transactionsWithBalance = sortedTransactions.map((tx) => {
    const balanceAfter = runningBalance;
    runningBalance -= tx.amount;
    return { ...tx, balanceAfter };
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your credits and view transaction history</p>
        </div>
        <Button onClick={() => setShowBuyModal(true)} className="gap-2">
          <Coins className="w-4 h-4" />
          Buy Credits
        </Button>
      </div>

      {/* Success Banner */}
      {successCredits !== null && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 font-medium">
            {successCredits.toLocaleString()} credits added to your account.
          </p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-500">Credit Balance</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {userCredits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ${(userCredits / 100).toFixed(2)} value
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-500">This Month</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {usage.used.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            of {usage.limit} clip limit
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-500">Plan</span>
          </div>
          <div className="text-2xl font-bold text-white capitalize">
            {usage.plan}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {usage.limit} clips/month
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Transaction History</h2>
        </div>

        {transactionsWithBalance.length === 0 ? (
          <div className="py-12 text-center">
            <Coins className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No transactions yet.</p>
            <p className="text-xs text-slate-600 mt-1">Purchase credits to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transactionsWithBalance.map((tx) => {
                  const amountDisplay = formatAmount(tx.amount);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {tx.description || tx.type.replace(/_/g, ' ')}
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono text-right whitespace-nowrap ${amountDisplay.className}`}>
                        {amountDisplay.text}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-slate-400 whitespace-nowrap">
                        {tx.balanceAfter.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Buy Credits Modal */}
      {showBuyModal && (
        <BuyCreditsModal
          onClose={() => setShowBuyModal(false)}
          onSuccess={(credits) => {
            setShowBuyModal(false);
            toast.success(`${credits.toLocaleString()} credits added!`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
