import React, { useCallback, useEffect, useState } from 'react';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { mergePlaidData, parseSyncResult, unlinkPlaidItem } from '../services/plaidSync';
import PlaidLinkButton from './PlaidLinkButton';

interface BankRow {
    id: string;
    itemId: string;
    institutionName: string | null;
    connectedAt: string | null;
    lastSyncedAt: string | null;
}

const formatDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString() : '—';

/**
 * Settings card listing Plaid-connected banks with per-bank Refresh and
 * Disconnect (keep-but-unlink: imported loans/expenses stay, badges go).
 * Hidden entirely for guests.
 */
const ConnectedBanksCard: React.FC = () => {
    const { user, isGuest } = useAuth();
    const { setFinances } = useFinance();
    const [banks, setBanks] = useState<BankRow[]>([]);
    const [busyItemId, setBusyItemId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isSignedIn = !!user && !isGuest;

    const loadBanks = useCallback(async () => {
        if (!isSignedIn) return;
        try {
            const { data } = await client.models.PlaidItem.list();
            setBanks(
                data.map(item => ({
                    id: item.id,
                    itemId: item.itemId,
                    institutionName: item.institutionName ?? null,
                    connectedAt: item.connectedAt ?? null,
                    lastSyncedAt: item.lastSyncedAt ?? null,
                }))
            );
        } catch {
            // Listing is best-effort; the card just shows the empty state.
        }
    }, [isSignedIn]);

    useEffect(() => {
        loadBanks();
    }, [loadBanks]);

    if (!isSignedIn) return null;

    const handleRefresh = async (itemId: string) => {
        setBusyItemId(itemId);
        setError(null);
        try {
            const { data, errors } = await client.mutations.syncPlaidData({ itemId });
            if (errors?.length) throw new Error(errors[0].message);
            const imported = parseSyncResult(data);
            setFinances(prev => mergePlaidData(prev, imported));
            await loadBanks();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Refresh failed');
        } finally {
            setBusyItemId(null);
        }
    };

    const handleDisconnect = async (itemId: string, institutionName: string | null) => {
        const name = institutionName ?? 'this bank';
        if (!window.confirm(`Disconnect ${name}? Imported loans and expenses stay in the app, but will no longer refresh from the bank.`)) {
            return;
        }
        setBusyItemId(itemId);
        setError(null);
        try {
            const { errors } = await client.mutations.disconnectPlaidItem({ itemId });
            if (errors?.length) throw new Error(errors[0].message);
            setFinances(prev => unlinkPlaidItem(prev, itemId));
            await loadBanks();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Disconnect failed');
        } finally {
            setBusyItemId(null);
        }
    };

    return (
        <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <h2 className="text-xl font-semibold mb-4">Connected Banks</h2>
            {banks.length === 0 ? (
                <div className="space-y-3">
                    <p className="text-sm text-dark-text-secondary">
                        No banks connected. Connect one to import your loans and recurring bills automatically.
                    </p>
                    <PlaidLinkButton onImported={loadBanks} label="🏦 Connect a bank" />
                </div>
            ) : (
                <div className="space-y-4">
                    {banks.map(bank => (
                        <div
                            key={bank.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-900/50 border border-dark-border rounded-lg p-4"
                        >
                            <div>
                                <p className="font-semibold">{bank.institutionName ?? 'Bank'}</p>
                                <p className="text-xs text-dark-text-secondary">
                                    Connected {formatDate(bank.connectedAt)} · Last synced {formatDate(bank.lastSyncedAt)}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleRefresh(bank.itemId)}
                                    disabled={busyItemId !== null}
                                    className="text-sm bg-dark-bg border border-accent text-accent py-1.5 px-3 rounded-lg hover:bg-accent hover:text-dark-bg transition-colors disabled:opacity-60"
                                >
                                    {busyItemId === bank.itemId ? 'Working…' : 'Refresh'}
                                </button>
                                <button
                                    onClick={() => handleDisconnect(bank.itemId, bank.institutionName)}
                                    disabled={busyItemId !== null}
                                    className="text-sm bg-red-600/20 text-red-400 border border-red-500 py-1.5 px-3 rounded-lg hover:bg-red-600/40 transition-colors disabled:opacity-60"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ))}
                    <PlaidLinkButton onImported={loadBanks} label="🏦 Connect another bank" />
                </div>
            )}
            {error && (
                <p className="mt-3 text-sm text-red-400" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

export default ConnectedBanksCard;
