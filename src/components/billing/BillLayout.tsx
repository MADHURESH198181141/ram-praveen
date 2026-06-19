import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Bill, BillPage } from '@/types';
import { cn } from '@/lib/utils';
import { getSettings } from '@/lib/storage';
import { translateToTamil } from '@/lib/translate';

// Component to handle live translations on the bill for missing Tamil names
const AutoTranslatedText = ({ text, fallback }: { text: string, fallback: string }) => {
    const [translated, setTranslated] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;
        translateToTamil(text).then(res => {
            if (mounted && res) {
                setTranslated(res);
            }
        });
        return () => { mounted = false; };
    }, [text]);

    if (translated) {
        return <span className="TamilFont text-[11px]">{translated}</span>;
    }
    return <span>{fallback}</span>;
};

interface BillLayoutProps {
    bill: Bill;
    className?: string;
    isPrinting?: boolean;
}

export const BillLayout: React.FC<BillLayoutProps> = ({ bill, className, isPrinting = false }) => {
    const settings = getSettings();

    return (
        <div className={cn("flex flex-col", className)}>
            {bill.pages.map((page: BillPage, pageIdx: number) => (
                <div
                    key={pageIdx}
                    className={cn(
                        "bill-print font-sans bg-white text-black",
                        isPrinting && pageIdx < bill.pages.length - 1 ? "print-page-break" : "",
                        !isPrinting && "p-4 border rounded-lg shadow-sm mb-8 last:mb-0"
                    )}
                    style={!isPrinting ? { width: '100%', maxWidth: '800px', margin: '0 auto' } : {}}
                >
                    {/* Logo and Store Name */}
                    <div className="flex flex-col items-center mb-2">
                        <div className="flex items-center gap-3 w-full justify-center mb-1">
                            <div className="w-12 h-12 border border-black flex items-center justify-center">
                                <UserIcon className="h-10 w-10 text-black" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-base font-bold uppercase tracking-tight">{settings.storeName}</h2>
                                <p className="text-[12px] font-bold TamilFont font-tamil">PSS கிருஷ்ணா ஸ்டோர்ஸ்</p>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold TamilFont mb-1">ஸ்ரீ கண்டம்மாள்துணை</p>
                        <p className="text-[9px] text-center leading-tight">{settings.storeAddress}</p>
                        <h3 className="text-xs font-bold border-y border-black w-full text-center my-1 py-0.5">SALES INVOICE</h3>
                    </div>

                    {/* Bill Metadata */}
                    <div className="space-y-0.5 mb-2 text-[10px]">
                        <div className="flex justify-between">
                            <span>Bill No. <span className="font-bold">{bill.billNumber}</span></span>
                            <span>Date <span className="font-bold">{new Date(bill.createdAt).toLocaleDateString('en-IN')}</span></span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="flex gap-2">
                                <span className="TamilFont">வாடிக்கையாளர்</span>
                                <span className="font-bold">
                                    {bill.customerNameTamil ? (
                                        <span className="TamilFont">{bill.customerNameTamil}</span>
                                    ) : (
                                        bill.customerName !== 'Cash' 
                                            ? <AutoTranslatedText text={bill.customerName || ''} fallback={bill.customerName || 'Cash'} />
                                            : 'Cash'
                                    )}
                                </span>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[8px] font-bold">Page {page.pageNumber} of {bill.pages.length}</span>
                                <span className="text-[9px]">EXE: {bill.employeeName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-left mb-1 border-collapse border-t border-black text-[10px]">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="py-1 font-bold border-r border-black pl-1"><span className="TamilFont">பொருள்</span></th>
                                <th className="py-1 text-center font-bold border-r border-black w-12">Qty</th>
                                <th className="py-1 text-right font-bold border-r border-black w-14">Rate</th>
                                <th className="py-1 text-right font-bold pr-1 w-16">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {page.items.map((item) => (
                                <tr key={item.id} className="border-b border-gray-200">
                                    <td className="py-1 border-r border-black pl-1 leading-tight">
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {item.nameTamil ? (
                                                    <span className="TamilFont text-[11px]">{item.nameTamil}</span>
                                                ) : (
                                                    <AutoTranslatedText text={item.productName} fallback={item.productName} />
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-1 text-center font-mono border-r border-black">{item.quantity.toFixed(0)}</td>
                                    <td className="py-1 text-right font-mono border-r border-black">{item.unitPrice.toFixed(2)}</td>
                                    <td className="py-1 text-right font-mono font-bold pr-1">{item.totalPrice.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            {/* If there's a previous page, show Brought Forward */}
                            {pageIdx > 0 && (
                                <tr className="border-t border-black font-semibold text-gray-700">
                                    <td colSpan={3} className="py-1 text-right border-r border-black pr-2">B/F (Previous Page Total)</td>
                                    <td className="py-1 text-right font-mono pr-1">{(page.cumulativeTotal - page.pageTotal).toFixed(2)}</td>
                                </tr>
                            )}
                            
                            {/* Always show Current Page Total */}
                            <tr className={cn("border-t border-black", pageIdx === bill.pages.length - 1 ? "" : "font-bold")}>
                                <td colSpan={3} className="py-1 text-right border-r border-black pr-2">Page Total</td>
                                <td className="py-1 text-right font-mono pr-1">{page.pageTotal.toFixed(2)}</td>
                            </tr>

                            {/* Show Final Totals only on the last page */}
                            {pageIdx === bill.pages.length - 1 && (
                                <tr className="border-t border-black font-bold">
                                    <td className="py-1 text-right border-r border-black pr-2">Total Quantity</td>
                                    <td className="py-1 text-center border-r border-black font-mono">{bill.items.reduce((sum, item) => sum + item.quantity, 0).toFixed(0)}</td>
                                    <td className="py-1 text-right border-r border-black text-[9px] pr-1">Total Items {bill.items.length}</td>
                                    <td className="py-1 text-right font-mono pr-1">{bill.totalAmount.toFixed(2)}</td>
                                </tr>
                            )}
                        </tfoot>
                    </table>

                    {pageIdx === bill.pages.length - 1 && (
                        <>
                            {/* Grand Total Section */}
                            <div className="border-y-2 border-black border-double py-1 mb-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-sm font-bold TamilFont tracking-widest">மொத்த தொகை</span>
                                    <span className="text-xl font-bold font-mono">{bill.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Message and Divider */}
                            <div className="text-center space-y-1 mb-2">
                                <p className="font-bold text-[10px] break-words px-2">{settings.billFooterMessage}</p>
                                <p className="TamilFont text-[9px] leading-tight break-words px-2">{settings.billFooterSubMessage}</p>
                                <p className="text-[10px] tracking-[3px]">******************************</p>
                                <p className="text-[8px] uppercase">{settings.storeName}</p>
                            </div>

                            {/* Conditional QR Code */}
                            {settings.showQrOnBill && bill.isDelivery && (
                                <div className="flex flex-col items-center mt-3">
                                    <div className="border border-black p-1 bg-white mb-1">
                                        {settings.upiQrImageBase64 ? (
                                            <img
                                                src={settings.upiQrImageBase64}
                                                alt="UPI QR Code"
                                                style={{ width: 80, height: 80, objectFit: 'contain' }}
                                            />
                                        ) : settings.upiId ? (
                                            <QRCodeSVG
                                                value={`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.storeName)}&am=${bill.totalAmount.toFixed(2)}&cu=INR`}
                                                size={80}
                                            />
                                        ) : null}
                                    </div>
                                    <p className="text-[8px] font-mono">{settings.upiId}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};
