/**
 * Universal Unit Formatting Utility
 * Handles all product types: weight, volume, packs, count items
 */

export interface VariantInfo {
    variant_name?: string;
    variant_value?: number;
    variant_unit?: string;
}

/**
 * Parses a variant name to extract quantity and unit
 * Examples: "500g" → {qty: 500, unit: "g"}, "1kg" → {qty: 1, unit: "kg"}
 */
export function parseVariantName(name: string): { qty: number; unit: string } | null {
    if (!name) return null;
    const str = name.toLowerCase().trim();

    // Match patterns: "500g", "1kg", "200ml", "1ltr", "12 pcs", "1 dozen", etc.
    const match = str.match(/^(\d+\.?\d*)\s*(kg|g|gm|gram|grams|ltr|l|litre|liter|ml|millilitre|milliliter|dozen|doz|pack|packs|box|boxes|pcs|pieces|piece|pc|pair|pairs|unit|units)?\s*$/i);
    if (match) {
        return { qty: parseFloat(match[1]), unit: match[2] || '' };
    }
    return null;
}

/**
 * Normalizes a unit to a standard form
 */
export function normalizeUnit(unit: string): string {
    const u = (unit || '').toLowerCase().trim();

    // Weight
    if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return 'kg';
    if (u === 'g' || u === 'gm' || u === 'gram' || u === 'grams') return 'g';

    // Volume
    if (u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter' || u === 'litres' || u === 'liters') return 'L';
    if (u === 'ml' || u === 'millilitre' || u === 'milliliter') return 'ml';

    // Count
    if (u === 'dozen' || u === 'doz') return 'dozen';
    if (u === 'pack' || u === 'packs') return 'pack';
    if (u === 'box' || u === 'boxes') return 'box';
    if (u === 'pair' || u === 'pairs') return 'pair';
    if (u === 'pcs' || u === 'pieces' || u === 'piece' || u === 'pc') return 'pcs';
    if (u === 'unit' || u === 'units') return 'unit';

    return u || 'pack'; // Default to pack instead of piece
}

/**
 * Gets the effective value and unit from a variant, parsing from name if needed
 */
export function getEffectiveVariant(variant: VariantInfo): { value: number; unit: string } {
    let effectiveValue = variant.variant_value || 1;
    let effectiveUnit = normalizeUnit(variant.variant_unit || '');

    // Parse from variant_name if value seems wrong (1 or 0) or name has better info
    const parsed = parseVariantName(variant.variant_name || '');
    if (parsed) {
        if (parsed.qty > 1 || effectiveValue <= 1) {
            effectiveValue = parsed.qty;
        }
        if (parsed.unit) {
            effectiveUnit = normalizeUnit(parsed.unit);
        }
    }

    return { value: effectiveValue, unit: effectiveUnit };
}

/**
 * Formats a weight value with smart kg/g conversion
 */
export function formatWeight(grams: number): string {
    if (grams >= 1000) {
        const kg = grams / 1000;
        return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(1).replace(/\.0$/, '')} kg`;
    }
    return `${Math.round(grams)} g`;
}

/**
 * Formats a volume value with smart L/ml conversion
 */
export function formatVolume(ml: number): string {
    if (ml >= 1000) {
        const liters = ml / 1000;
        return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(1).replace(/\.0$/, '')} L`;
    }
    return `${Math.round(ml)} ml`;
}

/**
 * Formats variant display for product buttons (e.g., "500g", "1L", "12 pcs")
 */
export function formatVariantDisplay(variant: VariantInfo): string {
    const { value, unit } = getEffectiveVariant(variant);

    // Weight - show in g/kg with smart conversion
    if (unit === 'kg') {
        return formatWeight(value * 1000);
    }
    if (unit === 'g') {
        return formatWeight(value);
    }

    // Volume - show in ml/L with smart conversion
    if (unit === 'L') {
        return formatVolume(value * 1000);
    }
    if (unit === 'ml') {
        return formatVolume(value);
    }

    // Count items
    if (value === 1) {
        return `1 ${unit}`;
    }

    // For packs/boxes/dozens with multiple
    return `${value} ${unit}`;
}

/**
 * Calculates and formats total quantity for order display
 * Examples:
 * - 2 × 250g → "500 g"
 * - 3 × 500ml → "1.5 L"
 * - 1 × 12 pcs pack → "1 pack (12 pcs)"
 */
export function formatOrderQuantity(
    orderQuantity: number,
    variant: VariantInfo | null,
    productUnit?: string
): string {
    if (!variant) {
        // No variant - show quantity with product unit
        const unit = normalizeUnit(productUnit || 'pack');
        return orderQuantity === 1 ? `1 ${unit}` : `${orderQuantity} ${unit}s`;
    }

    const { value, unit } = getEffectiveVariant(variant);
    const totalValue = orderQuantity * value;

    // Weight - calculate total and format
    if (unit === 'kg') {
        return formatWeight(totalValue * 1000);
    }
    if (unit === 'g') {
        return formatWeight(totalValue);
    }

    // Volume - calculate total and format
    if (unit === 'L') {
        return formatVolume(totalValue * 1000);
    }
    if (unit === 'ml') {
        return formatVolume(totalValue);
    }

    // Dozen - show as "1 dozen (12 pcs)" or "2 dozen (24 pcs)"
    if (unit === 'dozen') {
        const totalPcs = totalValue * 12;
        return orderQuantity === 1
            ? `1 dozen (${totalPcs} pcs)`
            : `${orderQuantity} dozen (${totalPcs} pcs)`;
    }

    // Packs/boxes/pairs with content info
    if (unit === 'pack' || unit === 'box' || unit === 'pair') {
        // If value > 1, it's likely a pack containing X items
        if (value > 1) {
            return orderQuantity === 1
                ? `1 ${unit} (${value} pcs)`
                : `${orderQuantity} ${unit}s (${totalValue} pcs total)`;
        }
        return orderQuantity === 1 ? `1 ${unit}` : `${orderQuantity} ${unit}s`;
    }

    // Generic count (pcs, units)
    if (unit === 'pcs' || unit === 'unit') {
        return `${totalValue} ${unit}`;
    }

    // Fallback
    return `${totalValue} ${unit || 'pack'}`;
}

/**
 * Formats price display with unit (e.g., "₹60 / 500g")
 */
export function formatPriceUnit(variant: VariantInfo | null, productUnit?: string): string {
    if (!variant) {
        return productUnit ? normalizeUnit(productUnit) : 'pack';
    }
    return formatVariantDisplay(variant);
}
