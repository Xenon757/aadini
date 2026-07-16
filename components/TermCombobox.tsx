import React, { useState, useRef, useEffect } from 'react';

const TERM_PRESETS: { label: string; months: number }[] = [
    { label: '1 year (12 months)', months: 12 },
    { label: '2 years (24 months)', months: 24 },
    { label: '3 years (36 months)', months: 36 },
    { label: '4 years (48 months)', months: 48 },
    { label: '5 years (60 months)', months: 60 },
    { label: '6 years (72 months)', months: 72 },
    { label: '7 years (84 months)', months: 84 },
    { label: '8 years (96 months)', months: 96 },
    { label: '10 years (120 months)', months: 120 },
    { label: '15 years (180 months)', months: 180 },
    { label: '20 years (240 months)', months: 240 },
    { label: '25 years (300 months)', months: 300 },
    { label: '30 years (360 months)', months: 360 },
];

interface TermComboboxProps {
    termYears: number;
    onChange: (termYears: number) => void;
    className?: string;
}

const TermCombobox: React.FC<TermComboboxProps> = ({ termYears, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(String(Math.round(termYears * 12)));
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const months = Math.round(termYears * 12);
        setInputValue(String(months));
    }, [termYears]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const commitInput = () => {
        const months = parseInt(inputValue, 10);
        if (!isNaN(months) && months > 0) {
            onChange(months / 12);
        } else {
            setInputValue(String(Math.round(termYears * 12)));
        }
    };

    const handlePresetSelect = (months: number) => {
        setInputValue(String(months));
        onChange(months / 12);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="flex">
                <input
                    ref={inputRef}
                    type="number"
                    min={1}
                    value={inputValue}
                    placeholder="Enter months"
                    onFocus={(e) => { e.target.select(); setOpen(true); }}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={commitInput}
                    onKeyDown={(e) => { if (e.key === 'Enter') { commitInput(); setOpen(false); } if (e.key === 'Escape') setOpen(false); }}
                    className="w-full bg-dark-bg border-dark-border rounded-l-md shadow-sm focus:ring-accent focus:border-accent text-sm px-3 py-2 border"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
                    className="px-2 bg-dark-bg border border-l-0 border-dark-border rounded-r-md hover:bg-gray-800 transition-colors flex-shrink-0"
                    aria-label="Show term presets"
                >
                    <svg className={`w-4 h-4 text-dark-text-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            <p className="text-xs text-dark-text-secondary mt-1">months</p>
            {open && (
                <ul className="absolute z-50 mt-1 w-full bg-dark-card border border-dark-border rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {TERM_PRESETS.map(preset => (
                        <li key={preset.months}>
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handlePresetSelect(preset.months); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors ${Math.round(termYears * 12) === preset.months ? 'text-accent bg-accent/5' : 'text-dark-text'}`}
                            >
                                {preset.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TermCombobox;
