import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Supplier } from '@/types';
import { saveSupplier, getNextSupplierCode } from '@/lib/storage';
import { toast } from 'sonner';
import { UserPlus, Save, X } from 'lucide-react';
import { generateId } from '@/lib/utils';


interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (supplier: Supplier) => void;
    editSupplier?: Supplier | null;
}

const emptySupplier = (): Supplier => ({
    id: generateId(),

    name: '',
    supplierCode: '',
    phone: '',
    email: '',
    contactPerson: '',
    gstNumber: '',
    panNumber: '',
    address1: '',
    address2: '',
    address3: '',
    city: '',
    zip: '',
    state: '',
    country: 'India',
    openingBalance: 0,
    creditLimit: 0,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
});

export const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, onSuccess, editSupplier }) => {
    const [supplier, setSupplier] = useState<Supplier>(emptySupplier());
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            if (editSupplier) {
                setSupplier(editSupplier);
            } else {
                const newSup = emptySupplier();
                newSup.supplierCode = getNextSupplierCode();
                setSupplier(newSup);
            }
            setErrors({});
        }
    }, [isOpen, editSupplier]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!supplier.name.trim()) newErrors.name = 'Supplier name is required';
        if (!supplier.phone.trim()) newErrors.phone = 'Phone number is required';
        else if (!/^\d{10}$/.test(supplier.phone)) newErrors.phone = 'Valid 10-digit phone is required';

        if (supplier.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(supplier.gstNumber)) {
            newErrors.gstNumber = 'Invalid GST format';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;

        saveSupplier(supplier);
        toast.success(editSupplier ? 'Supplier updated successfully' : 'Supplier created successfully');
        onSuccess(supplier);
        onClose();
    };

    const handleChange = (field: keyof Supplier, value: any) => {
        setSupplier(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[field];
                return newErrs;
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 border-b bg-muted/30">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <UserPlus className="h-5 w-5 text-primary" />
                        {editSupplier ? 'Edit Supplier' : 'Create New Supplier'}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Basic Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Basic Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Supplier Code</Label>
                                    <Input value={supplier.supplierCode} readOnly className="bg-muted font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Contact Person</Label>
                                    <Input
                                        value={supplier.contactPerson}
                                        onChange={(e) => handleChange('contactPerson', e.target.value)}
                                        placeholder="Name of contact person"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs uppercase">Supplier Name <span className="text-destructive">*</span></Label>
                                <Input
                                    value={supplier.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder="Company or Individual Name"
                                    className={errors.name ? "border-destructive" : ""}
                                />
                                {errors.name && <span className="text-[10px] text-destructive">{errors.name}</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Phone <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={supplier.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        placeholder="10-digit mobile"
                                        className={errors.phone ? "border-destructive" : ""}
                                    />
                                    {errors.phone && <span className="text-[10px] text-destructive">{errors.phone}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Email</Label>
                                    <Input
                                        type="email"
                                        value={supplier.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        placeholder="example@email.com"
                                    />
                                </div>
                            </div>

                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-6">Tax Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">GST Number</Label>
                                    <Input
                                        value={supplier.gstNumber}
                                        onChange={(e) => handleChange('gstNumber', e.target.value.toUpperCase())}
                                        placeholder="22AAAAA0000A1Z5"
                                        className={errors.gstNumber ? "border-destructive" : ""}
                                    />
                                    {errors.gstNumber && <span className="text-[10px] text-destructive">{errors.gstNumber}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">PAN Number</Label>
                                    <Input
                                        value={supplier.panNumber}
                                        onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                                        placeholder="ABCDE1234F"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address & Financial */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Address Details</h3>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase">Address Line 1</Label>
                                <Input value={supplier.address1} onChange={(e) => handleChange('address1', e.target.value)} placeholder="Building No, Street" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase">Address Line 2</Label>
                                <Input value={supplier.address2} onChange={(e) => handleChange('address2', e.target.value)} placeholder="Area, Landmark" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">City</Label>
                                    <Input value={supplier.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="City" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Zip Code</Label>
                                    <Input value={supplier.zip} onChange={(e) => handleChange('zip', e.target.value)} placeholder="6-digit PIN" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">State</Label>
                                    <Input value={supplier.state} onChange={(e) => handleChange('state', e.target.value)} placeholder="State" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Country</Label>
                                    <Input value={supplier.country} onChange={(e) => handleChange('country', e.target.value)} placeholder="Country" />
                                </div>
                            </div>

                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-6">Financials & Notes</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Opening Balance (₹)</Label>
                                    <Input
                                        type="number"
                                        value={supplier.openingBalance}
                                        onChange={(e) => handleChange('openingBalance', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase">Credit Limit (₹)</Label>
                                    <Input
                                        type="number"
                                        value={supplier.creditLimit}
                                        onChange={(e) => handleChange('creditLimit', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase">Notes</Label>
                                <Textarea
                                    value={supplier.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    placeholder="Additional supplier information..."
                                    className="min-h-[80px]"
                                />
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t bg-muted/30">
                    <Button variant="outline" onClick={onClose} className="gap-2">
                        <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={handleSave} className="gap-2">
                        <Save className="h-4 w-4" /> {editSupplier ? 'Update Supplier' : 'Save Supplier'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
