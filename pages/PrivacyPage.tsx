import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
        <h2 className="text-xl font-semibold text-dark-text">{title}</h2>
        <div className="text-dark-text-secondary space-y-3 leading-relaxed">{children}</div>
    </section>
);

/**
 * Publicly reachable at /privacy (rendered before auth branching in
 * App.tsx). Referenced by the Plaid production application and available
 * to end users from the landing page footer and Settings.
 */
const PrivacyPage: React.FC = () => (
    <div className="min-h-screen bg-dark-bg text-dark-text">
        <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-10">
            <header className="space-y-2">
                <a href="/" className="text-accent hover:text-accent-hover text-sm">&larr; Back to Modulos</a>
                <h1 className="text-3xl font-bold text-accent">Privacy Policy</h1>
                <p className="text-sm text-dark-text-secondary">Effective date: July 17, 2026</p>
            </header>

            <Section title="Who we are">
                <p>
                    Modulos is a personal debt management application that helps you track loans,
                    expenses, and build a debt payoff plan. It is operated by an individual developer.
                    Contact: <a href="mailto:sri.meduri@berkeley.edu" className="text-accent hover:text-accent-hover">sri.meduri@berkeley.edu</a>.
                </p>
            </Section>

            <Section title="Information we collect">
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        <span className="text-dark-text">Account information:</span> your email address,
                        used to create and secure your account (via Amazon Cognito). If you sign in with
                        Google, we receive your email and basic profile from Google.
                    </li>
                    <li>
                        <span className="text-dark-text">Financial information you enter:</span> income,
                        expenses, and loan details you type into the app.
                    </li>
                    <li>
                        <span className="text-dark-text">Financial information from your bank (optional):</span>{' '}
                        if you choose to connect a bank account through Plaid, we receive loan balances,
                        interest rates, minimum payments, and recurring transaction summaries for the
                        accounts you select. Connecting a bank is entirely optional — every feature works
                        with manually entered data.
                    </li>
                </ul>
            </Section>

            <Section title="Bank connections and Plaid">
                <p>
                    Bank connections are powered by Plaid Inc. You authenticate directly with your bank
                    through Plaid — Modulos never sees or stores your bank username or password. Plaid
                    provides us with access tokens, which are stored server-side in encrypted storage and
                    are never accessible from your browser.
                </p>
                <p>
                    Plaid's handling of your data is described in the{' '}
                    <a
                        href="https://plaid.com/legal/#end-user-privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover"
                    >
                        Plaid End User Privacy Policy
                    </a>.
                </p>
            </Section>

            <Section title="How we use your information">
                <p>
                    Your data is used solely to provide the app's functionality: showing your dashboard,
                    calculating payoff plans, and checking loan affordability. We do not sell your data,
                    show ads, or share your information with third parties other than the service
                    providers that host the application (Amazon Web Services) and power bank connections
                    (Plaid).
                </p>
            </Section>

            <Section title="Guest mode">
                <p>
                    In guest mode, all data stays in your browser's local storage on your device. Nothing
                    is transmitted to or stored on our servers, and bank connections are unavailable.
                </p>
            </Section>

            <Section title="Storage and security">
                <ul className="list-disc pl-5 space-y-2">
                    <li>All data is stored on Amazon Web Services and encrypted at rest and in transit (TLS).</li>
                    <li>Your records are isolated per-account — each user can only access their own data.</li>
                    <li>Plaid access tokens are held in storage reachable only by our backend, never by browsers.</li>
                </ul>
            </Section>

            <Section title="Deleting your data">
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        <span className="text-dark-text">Delete everything:</span> Settings &rarr; "Delete All
                        Data" permanently removes your financial data from our servers.
                    </li>
                    <li>
                        <span className="text-dark-text">Disconnect a bank:</span> Settings &rarr; Connected
                        Banks &rarr; Disconnect revokes our access with Plaid immediately.
                    </li>
                    <li>
                        To delete your account entirely, contact{' '}
                        <a href="mailto:sri.meduri@berkeley.edu" className="text-accent hover:text-accent-hover">sri.meduri@berkeley.edu</a>.
                    </li>
                </ul>
            </Section>

            <Section title="Changes to this policy">
                <p>
                    If this policy changes materially, the effective date above will be updated. Continued
                    use of the app after changes constitutes acceptance of the updated policy.
                </p>
            </Section>
        </div>
    </div>
);

export default PrivacyPage;
