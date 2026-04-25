import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

import { resolveApiBaseUrl } from './env';

describe('resolveApiBaseUrl', () => {
  it('keeps localhost for web and iOS simulators', () => {
    expect(resolveApiBaseUrl('http://localhost:4000', 'ios')).toBe('http://localhost:4000');
    expect(resolveApiBaseUrl('http://localhost:4000', 'web')).toBe('http://localhost:4000');
  });

  it('rewrites loopback hosts for Android emulators', () => {
    expect(resolveApiBaseUrl('http://localhost:4000', 'android')).toBe('http://10.0.2.2:4000');
    expect(resolveApiBaseUrl('http://127.0.0.1:4000', 'android')).toBe('http://10.0.2.2:4000');
  });

  it('leaves non-loopback hosts untouched', () => {
    expect(resolveApiBaseUrl('http://192.168.1.50:4000', 'android')).toBe('http://192.168.1.50:4000');
  });

  it('falls back to localhost when no base url is set', () => {
    expect(resolveApiBaseUrl(undefined, 'ios')).toBe('http://localhost:4000');
  });
});
