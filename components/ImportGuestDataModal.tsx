import React from 'react';

interface ImportGuestDataModalProps {
    onImport: () => void;
    onDiscard: () => void;
}

const ImportGuestDataModal: React.FC<ImportGuestDataModalProps> = ({ onImport, onDiscard }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold text-dark-text">Import your guest data?</h2>
            <p className="text-sm text-dark-text-secondary">
                We found finances/settings data saved from a previous guest session on this device.
                Would you like to import it into your account, or start fresh?
            </p>
            <div className="flex gap-3 pt-2">
                <button
                    onClick={onDiscard}
                    className="flex-1 bg-dark-border hover:bg-opacity-80 text-dark-text font-medium py-2 px-4 rounded-lg transition-colors"
                >
                    Start Fresh
                </button>
                <button
                    onClick={onImport}
                    className="flex-1 bg-accent hover:bg-accent-hover text-dark-bg font-medium py-2 px-4 rounded-lg transition-colors"
                >
                    Import Guest Data
                </button>
            </div>
        </div>
    </div>
);

export default ImportGuestDataModal;
