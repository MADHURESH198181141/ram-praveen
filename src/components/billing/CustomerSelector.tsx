import React, { useState, useEffect } from 'react';
import { User, Phone, UserPlus, Search, Languages, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Customer } from '@/types';
import { getCustomers, findCustomerByPhone, saveCustomer } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { translateToTamil } from '@/lib/translate';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer, isNew: boolean) => void;
  onClear: () => void;
}

export function CustomerSelector({ selectedCustomer, onCustomerSelect, onClear }: CustomerSelectorProps) {
  const [searchMode, setSearchMode] = useState<'phone' | 'name'>('phone');
  const [searchValue, setSearchValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerNameTamil, setNewCustomerNameTamil] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);

  useEffect(() => {
    if (searchValue.length >= 3) {
      const customers = getCustomers();
      if (searchMode === 'phone') {
        setSuggestions(customers.filter(c => c.phone.includes(searchValue)));
      } else {
        setSuggestions(customers.filter(c => 
          c.name.toLowerCase().includes(searchValue.toLowerCase())
        ));
      }
    } else {
      setSuggestions([]);
    }
  }, [searchValue, searchMode]);

  const handleSearch = () => {
    if (searchMode === 'phone' && searchValue.length === 10) {
      const existing = findCustomerByPhone(searchValue);
      if (existing) {
        onCustomerSelect(existing, false);
        setSearchValue('');
        setSuggestions([]);
      } else {
        setIsCreating(true);
      }
    }
  };

  const handleCreateCustomer = () => {
    if (newCustomerName.trim() && searchValue.length === 10) {
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        name: newCustomerName.trim(),
        nameTamil: newCustomerNameTamil.trim() || undefined,
        phone: searchValue,
        isRegular: false,
        totalPurchases: 0,
        pendingDues: 0,
        createdAt: new Date(),
        lastVisit: new Date(),
      };
      saveCustomer(newCustomer);
      onCustomerSelect(newCustomer, true);
      setSearchValue('');
      setNewCustomerName('');
      setNewCustomerNameTamil('');
      setIsCreating(false);
      setSuggestions([]);
    }
  };

  const handleAutoTranslate = async (text: string, force = false) => {
    if (!text.trim() || (!force && newCustomerNameTamil.trim())) return;
    setIsTranslating(true);
    try {
      const translated = await translateToTamil(text);
      if (translated) {
        setNewCustomerNameTamil(translated);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSelectSuggestion = (customer: Customer) => {
    onCustomerSelect(customer, false);
    setSearchValue('');
    setSuggestions([]);
  };

  if (selectedCustomer) {
    return (
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedCustomer.name}</span>
                {selectedCustomer.isRegular && (
                  <Badge variant="secondary" className="text-xs">Regular</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                {selectedCustomer.phone}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Change
          </Button>
        </div>
        {selectedCustomer.pendingDues > 0 && (
          <div className="mt-3 p-2 bg-pending/10 rounded-md border border-pending/20">
            <span className="text-sm text-pending font-medium">
              Pending Due: ₹{selectedCustomer.pendingDues.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={searchMode === 'phone' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSearchMode('phone')}
        >
          <Phone className="h-4 w-4 mr-1" />
          Phone
        </Button>
        <Button
          variant={searchMode === 'name' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSearchMode('name')}
        >
          <User className="h-4 w-4 mr-1" />
          Name
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchMode === 'phone' ? 'Enter 10-digit phone number' : 'Search by customer name'}
          value={searchValue}
          onChange={(e) => {
            const value = searchMode === 'phone' 
              ? e.target.value.replace(/\D/g, '').slice(0, 10)
              : e.target.value;
            setSearchValue(value);
            setIsCreating(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-10"
        />
      </div>

      {/* Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <div className="bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleSelectSuggestion(customer)}
              className="w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
            >
              <div>
                <div className="font-medium">{customer.name}</div>
                <div className="text-sm text-muted-foreground">{customer.phone}</div>
              </div>
              {customer.isRegular && (
                <Badge variant="secondary">Regular</Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create New Customer Form */}
      {isCreating && (
        <div className="bg-muted/30 p-4 rounded-lg space-y-3 animate-slide-in">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <UserPlus className="h-4 w-4" />
            New Customer
          </div>
          <div>
            <Label>Customer Name</Label>
            <Input
              placeholder="Enter customer name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              onBlur={(e) => handleAutoTranslate(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <Label>Customer Name (Tamil) - Optional</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs px-2" 
                onClick={() => handleAutoTranslate(newCustomerName, true)}
                disabled={isTranslating || !newCustomerName.trim()}
              >
                {isTranslating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Languages className="h-3 w-3 mr-1" />}
                Translate
              </Button>
            </div>
            <Input
              placeholder="Enter Tamil name"
              value={newCustomerNameTamil}
              onChange={(e) => setNewCustomerNameTamil(e.target.value)}
              className="mt-1 TamilFont"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateCustomer} disabled={!newCustomerName.trim()}>
              Create & Select
            </Button>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Quick lookup hint */}
      {!isCreating && !suggestions.length && searchValue.length === 10 && searchMode === 'phone' && (
        <Button onClick={handleSearch} className="w-full">
          <Search className="h-4 w-4 mr-2" />
          Look up customer
        </Button>
      )}
    </div>
  );
}
