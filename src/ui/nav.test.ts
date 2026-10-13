import { describe, expect, it } from 'vitest';
import { homeStep, openState, screenFromHash } from './nav.ts';

describe('the screen lives in the address', () => {
  it('reads the screen from the hash; anything else is the map', () => {
    expect(screenFromHash('#cards')).toBe('cards');
    expect(screenFromHash('refine')).toBe('refine');
    expect(screenFromHash('#craft')).toBe('craft');
    expect(screenFromHash('')).toBe('home');
    expect(screenFromHash('#')).toBe('home');
    expect(screenFromHash('#town')).toBe('home');
    expect(screenFromHash('#cards/extra')).toBe('home');
  });

  it('goes home a step back when the map opened the screen, and in place when the app opened on it', () => {
    expect(homeStep(openState())).toBe('back');
    expect(homeStep(null)).toBe('replace');
    expect(homeStep(undefined)).toBe('replace');
    expect(homeStep({ other: true })).toBe('replace');
    expect(homeStep('x')).toBe('replace');
  });
});
