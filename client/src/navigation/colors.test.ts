import { describe, expect, it } from 'vitest';

import { colors } from '@/navigation/colors';

describe('colors', () => {
  it('exports the white-first green and yellow palette tokens', () => {
    expect(colors.primary).toBe('#1F7A63');
    expect(colors.secondary).toBe('#F2C94C');
    expect(colors.accent).toBe('#D9A93F');
    expect(colors.background).toBe('#FAFBF8');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.text).toBe('#1F2925');
    expect(colors.border).toBe('rgba(31, 122, 99, 0.14)');
  });

  it('does not expose a red danger token in the brand system', () => {
    expect('danger' in colors).toBe(false);
  });
});
