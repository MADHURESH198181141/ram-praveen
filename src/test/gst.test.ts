import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGstRate, saveGstRate } from '../lib/gst-service';
import { PurchaseVoucherItem } from '../types';

describe('GST Service Logic', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    });

    it('should return correct GST for common HSN codes', async () => {
        const riceGst = await getGstRate('1006');
        expect(riceGst).toBe(5);

        const milkGst = await getGstRate('0401');
        expect(milkGst).toBe(0);

        const sodaGst = await getGstRate('2202');
        expect(sodaGst).toBe(28);
    });

    it('should use heuristic for unknown HSN codes', async () => {
        // HSN starting with 3 usually 18% (Industrial)
        const soapGst = await getGstRate('3401');
        expect(soapGst).toBe(18);

        // HSN starting with 0 usually 0% (Food)
        const specialMilk = await getGstRate('0999');
        expect(specialMilk).toBe(0);
    });

    it('should cache manually saved GST rates', async () => {
        saveGstRate('9999', 12);
        const rate = await getGstRate('9999');
        expect(rate).toBe(12);
    });

    it('should return null for empty or invalid HSN', async () => {
        expect(await getGstRate('')).toBeNull();
        expect(await getGstRate(undefined)).toBeNull();
    });
});

describe('Purchase Voucher Calculations', () => {
    // Note: This logic is tested within the component, but we can verify the formula here
    // Formula: Tax Amount = Gross Amount × GST% / 100, and Net Amount = Gross Amount + Tax Amount – Discount

    it('should calculate Tax and Net Amount correctly according to the formula', () => {
        const item: Partial<PurchaseVoucherItem> = {
            quantity: 10,
            unitRate: 100,
            gstPercentage: 18,
            discount: 10, // 10% discount
            conversionFactor: 1
        };

        const grossAmount = item.quantity! * item.unitRate!; // 1000
        const taxAmount = (grossAmount * item.gstPercentage!) / 100; // 180
        const discountAmount = (grossAmount * item.discount!) / 100; // 100
        const netAmount = grossAmount + taxAmount - discountAmount; // 1000 + 180 - 100 = 1080

        expect(grossAmount).toBe(1000);
        expect(taxAmount).toBe(180);
        expect(netAmount).toBe(1080);
    });
});
