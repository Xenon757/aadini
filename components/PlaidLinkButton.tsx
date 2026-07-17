import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { mergePlaidData, parseSyncResult } from '../services/plaidSync';

type Status = 'idle' | 'preparing' | 'linking' | 'importing';

interface PlaidLinkButtonProps {
    /** Called after a successful connect + import (e.g. to refresh a bank list). */
    onImported?: () => void;
    className?: string;
    label?: string;
}

/**
 * "Connect your bank" button: createPlaidLinkToken -> Plaid Link ->
 * exchangePlaidPublicToken -> syncPlaidData -> merge into finances.
 * Guests see a sign-in nudge instead; no AWS/Plaid calls are made.
 */
const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ onImported, className, label }) => {
    const { user, isGuest, openAuth } = useAuth();
    const { setFinances } = useFinance();
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [linkToken, setLinkToken] = useState<string | null>(null);

    const isSignedIn = !!user && !isGuest;

    const onSuccess = useCallback(
        async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
            setStatus('importing');
            setError(null);
            try {
                const { data: exchange, errors: exchangeErrors } =
                    await client.mutations.exchangePlaidPublicToken({
                        publicToken,
                        institutionId: metadata.institution?.institution_id,
                        institutionName: metadata.institution?.name,
                    });
                if (exchangeErrors?.length || !exchange) {
                    throw new Error(exchangeErrors?.[0]?.message ?? 'Bank connection failed');
                }
                const { data: sync, errors: syncErrors } = await client.mutations.syncPlaidData({
                    itemId: exchange.itemId,
                });
                if (syncErrors?.length) {
                    throw new Error(syncErrors[0].message);
                }
                const imported = parseSyncResult(sync);
                setFinances(prev => mergePlaidData(prev, imported));
                onImported?.();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Import failed');
            } finally {
                setStatus('idle');
                setLinkToken(null);
            }
        },
        [setFinances, onImported]
    );

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess,
        onExit: () => {
            setStatus('idle');
            setLinkToken(null);
        },
    });

    useEffect(() => {
        if (linkToken && ready && status === 'linking') {
            open();
        }
    }, [linkToken, ready, status, open]);

    const handleClick = async () => {
        setError(null);
        setStatus('preparing');
        try {
            const { data, errors } = await client.mutations.createPlaidLinkToken({});
            if (errors?.length || !data?.linkToken) {
                throw new Error(errors?.[0]?.message ?? 'Could not start bank connection');
            }
            setLinkToken(data.linkToken);
            setStatus('linking');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start bank connection');
            setStatus('idle');
        }
    };

    if (!isSignedIn) {
        return (
            <div className={className}>
                <p className="text-sm text-dark-text-secondary">
                    <button
                        onClick={() => openAuth('signin')}
                        className="text-accent hover:text-accent-hover underline"
                    >
                        Sign in
                    </button>{' '}
                    to connect your bank and import loans automatically.
                </p>
            </div>
        );
    }

    const busy = status !== 'idle';
    const busyLabel =
        status === 'preparing' ? 'Preparing…' : status === 'linking' ? 'Opening bank link…' : 'Importing…';

    return (
        <div className={className}>
            <button
                onClick={handleClick}
                disabled={busy}
                className="bg-dark-bg border border-accent text-accent font-semibold py-2 px-4 rounded-lg hover:bg-accent hover:text-dark-bg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {busy ? busyLabel : (label ?? '🏦 Import from bank')}
            </button>
            {error && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

export default PlaidLinkButton;
