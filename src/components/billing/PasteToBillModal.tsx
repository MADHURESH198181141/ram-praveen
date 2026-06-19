import React, { useState, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Product, BillItem } from '@/types';
import { getProducts } from '@/lib/storage';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    ClipboardPaste,
    MessageSquare,
    AlignLeft,
    Sparkles,
    Zap,
    Info,
} from 'lucide-react';
import { parseWhatsAppMessage, parseStructuredText, NLPMatch, ConfidenceLevel } from '@/lib/nlp-parser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasteToBillModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (items: BillItem[]) => void;
}

type ParseMode = 'nlp' | 'structured';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(level: ConfidenceLevel): string {
    if (level === 'high') return '#10b981';
    if (level === 'medium') return '#f59e0b';
    return '#ef4444';
}

function confidenceBg(level: ConfidenceLevel): string {
    if (level === 'high') return 'rgba(16,185,129,0.12)';
    if (level === 'medium') return 'rgba(245,158,11,0.12)';
    return 'rgba(239,68,68,0.12)';
}

function confidenceLabel(level: ConfidenceLevel): string {
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    return 'Low';
}

// ─── Example messages ─────────────────────────────────────────────────────────

const EXAMPLE_MESSAGES = [
    'bro 2 idly 1 dosa plz',
    'anna ek coffee venum',
    'send chips n coke 2 each',
    '2 இட்லி 1 காபி வேணும்',
    'idly-2, dosai-1, coffee-1',
    'pls give 3 chips and 2 coke today',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PasteToBillModal({ open, onOpenChange, onConfirm }: PasteToBillModalProps) {
    const [inputText, setInputText] = useState('');
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [parseMode, setParseMode] = useState<ParseMode>('nlp');

    const products = useMemo(() => getProducts(), [open]);

    // ── Parse ────────────────────────────────────────────────────────────────

    const nlpResult = useMemo(() => {
        if (!inputText.trim()) return null;
        return parseWhatsAppMessage(inputText, products);
    }, [inputText, products]);

    const structuredResult = useMemo(() => {
        if (!inputText.trim()) return null;
        return parseStructuredText(inputText, products);
    }, [inputText, products]);

    const matchedItems: BillItem[] = useMemo(() => {
        if (parseMode === 'nlp') return nlpResult?.billItems ?? [];
        return structuredResult?.matched ?? [];
    }, [parseMode, nlpResult, structuredResult]);

    const unmatchedLines: string[] = useMemo(() => {
        if (parseMode === 'nlp') return nlpResult?.unmatched.map(u => u.phrase) ?? [];
        return structuredResult?.unmatched ?? [];
    }, [parseMode, nlpResult, structuredResult]);

    const nlpMatches: NLPMatch[] = useMemo(() => {
        if (parseMode !== 'nlp') return [];
        return nlpResult?.matches ?? [];
    }, [parseMode, nlpResult]);

    const subtotal = matchedItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleNext = () => {
        if (inputText.trim()) setStep('preview');
    };

    const handleConfirm = () => {
        onConfirm(matchedItems);
        onOpenChange(false);
        setInputText('');
        setStep('input');
    };

    const handleClose = useCallback((val: boolean) => {
        onOpenChange(val);
        if (!val) {
            setInputText('');
            setStep('input');
        }
    }, [onOpenChange]);

    const loadExample = (msg: string) => setInputText(msg);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden" style={{ borderRadius: 20 }}>

                {/* ── Header ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    padding: '20px 24px 16px',
                    borderRadius: '20px 20px 0 0',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Decorative circles */}
                    <div style={{
                        position: 'absolute', top: -30, right: -30,
                        width: 120, height: 120, borderRadius: '50%',
                        background: 'rgba(99,102,241,0.15)', pointerEvents: 'none',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: -20, left: 60,
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'rgba(16,185,129,0.10)', pointerEvents: 'none',
                    }} />

                    <DialogTitle asChild>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 12,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                            }}>
                                <MessageSquare size={20} color="#fff" />
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                                    WhatsApp → Bill
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
                                    Paste any message and we'll generate the bill
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Sparkles size={16} color="#f59e0b" />
                                <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
                                    NLP POWERED
                                </span>
                            </div>
                        </div>
                    </DialogTitle>

                    {/* Mode Toggle */}
                    <div style={{
                        display: 'flex', gap: 8, marginTop: 14, position: 'relative', zIndex: 1,
                    }}>
                        {([
                            { mode: 'nlp' as ParseMode, icon: <Sparkles size={14} />, label: 'Smart (WhatsApp)' },
                            { mode: 'structured' as ParseMode, icon: <AlignLeft size={14} />, label: 'Structured Format' },
                        ]).map(({ mode, icon, label }) => (
                            <button
                                key={mode}
                                onClick={() => setParseMode(mode)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                                    fontSize: 12, fontWeight: 600,
                                    border: parseMode === mode ? '1.5px solid rgba(99,102,241,0.8)' : '1.5px solid rgba(255,255,255,0.12)',
                                    background: parseMode === mode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                                    color: parseMode === mode ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {/* INPUT STEP */}
                    {step === 'input' && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 24px' }}>

                            {/* Mode hint */}
                            {parseMode === 'nlp' ? (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: 12, padding: '12px 14px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <Zap size={16} color="#6366f1" style={{ marginTop: 1, flexShrink: 0 }} />
                                        <div>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>
                                                Smart Mode — paste any WhatsApp message!
                                            </p>
                                            <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                                                Understands slang, Tamil/English mix, abbreviations, and casual language.
                                            </p>
                                            {/* Quick examples */}
                                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {EXAMPLE_MESSAGES.slice(0, 4).map((msg, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => loadExample(msg)}
                                                        style={{
                                                            padding: '3px 10px', borderRadius: 20,
                                                            background: 'rgba(99,102,241,0.10)',
                                                            border: '1px solid rgba(99,102,241,0.2)',
                                                            color: '#6366f1', fontSize: 10, cursor: 'pointer',
                                                            fontFamily: 'monospace',
                                                        }}
                                                    >
                                                        {msg}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(241,245,249,0.7)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12, padding: '12px 14px',
                                }}>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                                        Format: PRODUCT NAME xQUANTITY
                                    </p>
                                    <code style={{
                                        fontSize: 11, display: 'block',
                                        background: '#fff', padding: '6px 10px', borderRadius: 8,
                                        color: '#334155', lineHeight: 1.8, border: '1px solid #e2e8f0',
                                    }}>
                                        IDLY x2<br />
                                        DOSA x1<br />
                                        COFFEE x2
                                    </code>
                                </div>
                            )}

                            {/* Textarea */}
                            <Textarea
                                placeholder={
                                    parseMode === 'nlp'
                                        ? 'Paste your WhatsApp message here...\n\ne.g. "bro 2 idly 1 dosa plz" or "anna ek coffee venum"'
                                        : 'Paste your order here...\n\nIDLY x2\nDOSA x1'
                                }
                                style={{
                                    flex: 1, minHeight: 200, fontSize: 14, padding: 14,
                                    resize: 'none', fontFamily: 'inherit',
                                    border: '1.5px solid #e2e8f0', borderRadius: 12,
                                    background: '#fafbff', lineHeight: 1.7,
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                            />

                            {/* Live preview badge */}
                            {inputText.trim() && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 14px', borderRadius: 10,
                                    background: matchedItems.length > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${matchedItems.length > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                }}>
                                    {matchedItems.length > 0 ? (
                                        <CheckCircle2 size={14} color="#10b981" />
                                    ) : (
                                        <AlertCircle size={14} color="#ef4444" />
                                    )}
                                    <span style={{
                                        fontSize: 12, fontWeight: 600,
                                        color: matchedItems.length > 0 ? '#059669' : '#dc2626',
                                    }}>
                                        {matchedItems.length > 0
                                            ? `${matchedItems.length} item${matchedItems.length > 1 ? 's' : ''} detected — ₹${subtotal.toFixed(0)} estimated`
                                            : 'No products recognized yet'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PREVIEW STEP */}
                    {step === 'preview' && (
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

                                {/* Matched */}
                                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #f1f5f9' }}>
                                    <div style={{
                                        padding: '14px 20px 10px',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <CheckCircle2 size={15} color="#10b981" />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Matched ({matchedItems.length})
                                        </span>
                                    </div>
                                    <ScrollArea style={{ flex: 1, height: 320 }}>
                                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {matchedItems.length > 0 ? matchedItems.map((item, idx) => {
                                                const nlpInfo = parseMode === 'nlp' ? nlpMatches.find(m => m.product.id === item.productId) : null;
                                                return (
                                                    <div key={idx} style={{
                                                        background: '#fff',
                                                        border: '1.5px solid #f0fdf4',
                                                        borderRadius: 12,
                                                        padding: '10px 12px',
                                                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 2 }}>
                                                                    {item.productName}
                                                                </p>
                                                                <p style={{ fontSize: 11, color: '#94a3b8' }}>
                                                                    Qty: {item.quantity} × ₹{item.unitPrice}
                                                                </p>
                                                                {nlpInfo && (
                                                                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <div style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                            padding: '2px 8px', borderRadius: 20,
                                                                            background: confidenceBg(nlpInfo.confidence),
                                                                            border: `1px solid ${confidenceColor(nlpInfo.confidence)}30`,
                                                                        }}>
                                                                            <div style={{
                                                                                width: 6, height: 6, borderRadius: '50%',
                                                                                background: confidenceColor(nlpInfo.confidence),
                                                                            }} />
                                                                            <span style={{ fontSize: 9, fontWeight: 700, color: confidenceColor(nlpInfo.confidence), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                                                {confidenceLabel(nlpInfo.confidence)}
                                                                            </span>
                                                                        </div>
                                                                        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                                                                            "{nlpInfo.matchedToken}"
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                                                                <p style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                                                                    ₹{item.totalPrice.toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>
                                                    No items matched
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Unmatched */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{
                                        padding: '14px 20px 10px',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <AlertCircle size={15} color="#ef4444" />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Not Found ({unmatchedLines.length})
                                        </span>
                                    </div>
                                    <ScrollArea style={{ flex: 1, height: 320 }}>
                                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {unmatchedLines.length > 0 ? unmatchedLines.map((line, idx) => (
                                                <div key={idx} style={{
                                                    background: '#fff5f5',
                                                    border: '1.5px solid #fee2e2',
                                                    borderRadius: 12,
                                                    padding: '10px 12px',
                                                }}>
                                                    <p style={{ fontSize: 12, color: '#b91c1c', fontFamily: 'monospace' }}>{line}</p>
                                                    <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Product not found in catalog</p>
                                                </div>
                                            )) : (
                                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                                    <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                                                    <p style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>All items recognized!</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>

                            {/* Total bar */}
                            <div style={{
                                background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                                padding: '14px 24px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div>
                                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                                        Estimated Total
                                    </p>
                                    <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1.2 }}>
                                        ₹{subtotal.toFixed(2)}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                                        {matchedItems.length} matched · {unmatchedLines.length} missed
                                    </p>
                                    {parseMode === 'nlp' && nlpMatches.length > 0 && (
                                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                                            Avg confidence: {Math.round(nlpMatches.reduce((s, m) => s + m.score, 0) / nlpMatches.length * 100)}%
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <DialogFooter style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', gap: 8 }}>
                    {step === 'input' ? (
                        <Button
                            onClick={handleNext}
                            disabled={!inputText.trim() || matchedItems.length === 0}
                            style={{
                                marginLeft: 'auto',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 10,
                                fontWeight: 700,
                                padding: '8px 20px',
                                display: 'flex', alignItems: 'center', gap: 8,
                                opacity: (!inputText.trim() || matchedItems.length === 0) ? 0.5 : 1,
                                cursor: (!inputText.trim() || matchedItems.length === 0) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <Sparkles size={15} />
                            Preview Bill
                            <ChevronRight size={15} />
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setStep('input')}
                                style={{ borderRadius: 10, fontWeight: 600 }}
                            >
                                ← Back to Edit
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={matchedItems.length === 0}
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff', border: 'none', borderRadius: 10,
                                    fontWeight: 700, padding: '8px 20px',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}
                            >
                                <CheckCircle2 size={15} />
                                Confirm & Add to Bill
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
