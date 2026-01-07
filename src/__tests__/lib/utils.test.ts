import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility function', () => {
    it('should merge class names correctly', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle undefined values', () => {
        expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
        expect(cn('base', true && 'included', false && 'excluded')).toBe('base included');
    });

    it('should merge tailwind classes properly', () => {
        // Later classes should override earlier conflicting ones
        expect(cn('p-4', 'p-8')).toBe('p-8');
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should handle empty inputs', () => {
        expect(cn()).toBe('');
        expect(cn('')).toBe('');
    });
});
