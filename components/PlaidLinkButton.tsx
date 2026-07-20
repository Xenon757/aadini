import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { mergePlaidData, parseSyncResult } from '../services/plaidSync';

type Status = 'idle' | 'preparing' | 'linking' | 'importing';

const OAUTH_TOKEN_KEY = 'plaid_oauth_link_token';

/** True when the page load is a return-redirect from a bank's OAuth login. */
const isOAuthRedirect = (): boolean =>
    window.location.search.includes('oauth_state_id=');

/** The OAuth return URL for this environment (must be Plaid-registered). */
const oauthRedirectUri = (): string => `${window.location.origin}/finances`;

interface PlaidLinkButtonProps {
    /** Called after a successful connect + import (e.g. to refresh a bank list). */
    onImported?: () => void;
    className?: string;
    label?: string;
}

/**
 * "Connect your bank" button: createPlaidLinkToken -> Plaid Link ->
 * exchangePlaidPublicToken -> syncPlaidData -> merge into finances.
 *
 * OAuth institutions (Chase, BofA, ...) leave the page for the bank's own
 * login and return here with ?oauth_state_id=...; the link token is kept
 * in sessionStorage across that round-trip and Link resumes automatically.
 *
 * Guests see a sign-in nudge instead; no AWS/Plaid calls are made.
 */
const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ onImported, className, label }) => {
    const { user, isGuest, openAuth } = useAuth();
    const { setFinances } = useFinance();
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [oauthResume, setOauthResume] = useState(false);

    const isSignedIn = !!user && !isGuest;

    const finishFlow = useCallback(() => {
        setStatus('idle');
        setLinkToken(null);
        setOauthResume(false);
        sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        if (isOAuthRedirect()) {
            // Strip Plaid's oauth params so a refresh doesn't re-trigger resume.
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

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
                finishFlow();
            }
        },
        [setFinances, onImported, finishFlow]
    );

    const { open, ready } = usePlaidLink({
        token: linkToken,
        // Required to resume Link after the bank's OAuth login round-trip.
        receivedRedirectUri: oauthResume ? window.location.href : undefined,
        onSuccess,
        onExit: (exitError) => {
            // Link closing itself carries a reason (OAuth bank not yet
            // enabled, institution down, user cancelled...) — show it
            // rather than vanishing silently.
            if (exitError) {
                setError(
                    exitError.display_message ||
                    exitError.error_message ||
                    `Connection closed (${exitError.error_code ?? 'unknown reason'})`
                );
            }
            finishFlow();
        },
    });

    // Resume Link automatically when returning from a bank OAuth redirect.
    useEffect(() => {
        if (!isSignedIn || !isOAuthRedirect()) return;
        const storedToken = sessionStorage.getItem(OAUTH_TOKEN_KEY);
        if (!storedToken) return;
        setOauthResume(true);
        setLinkToken(storedToken);
        setStatus('linking');
    }, [isSignedIn]);

    useEffect(() => {
        if (linkToken && ready && status === 'linking') {
            open();
        }
    }, [linkToken, ready, status, open]);

    const handleClick = async () => {
        setError(null);
        setStatus('preparing');
        try {
            const { data, errors } = await client.mutations.createPlaidLinkToken({
                redirectUri: oauthRedirectUri(),
            });
            if (errors?.length || !data?.linkToken) {
                throw new Error(errors?.[0]?.message ?? 'Could not start bank connection');
            }
            // Persist across a potential OAuth redirect away from this page.
            sessionStorage.setItem(OAUTH_TOKEN_KEY, data.linkToken);
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
