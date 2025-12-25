import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MapPin, Building, Home } from 'lucide-react';

interface AddressInputProps {
    value: string;
    onChange: (address: string) => void;
    savedAddress?: string;
    showSavedOption?: boolean;
}

export default function AddressInput({ value, onChange, savedAddress, showSavedOption = true }: AddressInputProps) {
    // Force 'new' when showSavedOption is false, otherwise use saved if available
    const [addressOption, setAddressOption] = useState<'saved' | 'new'>(
        showSavedOption && savedAddress ? 'saved' : 'new'
    );
    const [apartment, setApartment] = useState('');
    const [block, setBlock] = useState('');
    const [room, setRoom] = useState('');
    const [customAddress, setCustomAddress] = useState('');

    // Build full address from components
    useEffect(() => {
        if (addressOption === 'saved' && savedAddress) {
            onChange(savedAddress);
        } else if (addressOption === 'new') {
            if (apartment === 'Other') {
                onChange(customAddress);
            } else if (apartment && block && room) {
                const fullAddress = `${apartment}, Block ${block}, Room ${room}`;
                onChange(fullAddress);
            } else {
                onChange('');
            }
        }
    }, [addressOption, apartment, block, room, customAddress, savedAddress, onChange]);

    // Parse existing saved address to pre-fill fields
    useEffect(() => {
        if (savedAddress && savedAddress.includes('Block')) {
            const parts = savedAddress.split(',').map(s => s.trim());
            if (parts.length >= 3) {
                setApartment(parts[0]);
                const blockMatch = parts[1].match(/Block\s*(\S+)/i);
                const roomMatch = parts[2].match(/Room\s*(\S+)/i);
                if (blockMatch) setBlock(blockMatch[1]);
                if (roomMatch) setRoom(roomMatch[1]);
            }
        }
    }, [savedAddress]);

    return (
        <div className="space-y-4">
            {/* Saved vs New Address Option */}
            {showSavedOption && savedAddress && (
                <div className="space-y-2">
                    <Label>Delivery Address</Label>
                    <Select value={addressOption} onValueChange={(v: 'saved' | 'new') => setAddressOption(v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="saved">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Saved Address
                                </div>
                            </SelectItem>
                            <SelectItem value="new">
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    New Address
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Saved Address Display */}
            {addressOption === 'saved' && savedAddress && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{savedAddress}</span>
                    </div>
                </div>
            )}

            {/* New Address Form - Show when: no saved address, or user chose 'new', or showSavedOption is false */}
            {(addressOption === 'new' || !savedAddress || !showSavedOption) && (
                <div className="space-y-3">
                    {/* Apartment Selection */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Apartment
                        </Label>
                        <Select value={apartment} onValueChange={setApartment}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select apartment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VBHC Vaibhava">VBHC Vaibhava</SelectItem>
                                <SelectItem value="Symphony">Symphony</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Block and Room for selected apartments */}
                    {apartment && apartment !== 'Other' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Block / Tower</Label>
                                <Input
                                    placeholder="e.g., A, B, 1"
                                    value={block}
                                    onChange={(e) => setBlock(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Room Number</Label>
                                <Input
                                    placeholder="e.g., 101, 502"
                                    value={room}
                                    onChange={(e) => setRoom(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Custom Address for Other */}
                    {apartment === 'Other' && (
                        <div className="space-y-2">
                            <Label>Full Address</Label>
                            <Textarea
                                placeholder="Enter your complete delivery address"
                                value={customAddress}
                                onChange={(e) => setCustomAddress(e.target.value)}
                                rows={3}
                            />
                        </div>
                    )}

                    {/* Address Preview */}
                    {((apartment && apartment !== 'Other' && block && room) || (apartment === 'Other' && customAddress)) && (
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-xs text-muted-foreground mb-1">Delivery Address:</p>
                            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                                <Home className="h-4 w-4" />
                                <span>
                                    {apartment === 'Other'
                                        ? customAddress
                                        : `${apartment}, Block ${block}, Room ${room}`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
