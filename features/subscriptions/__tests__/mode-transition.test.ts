import { assessModeTransition } from '@/features/subscriptions/mode-transition';

describe('assessModeTransition', () => {
  it('does not warn when the mode is unchanged or unknown', () => {
    expect(assessModeTransition({ from: null, to: 'supabase', itemCount: 5 })).toMatchObject({
      requiresConfirmation: false,
    });
    expect(assessModeTransition({ from: 'local', to: 'local', itemCount: 5 })).toMatchObject({
      requiresConfirmation: false,
    });
  });

  it('warns before local → cloud, and says the data is kept, not lost', () => {
    const advice = assessModeTransition({ from: 'local', to: 'supabase', itemCount: 12 });

    expect(advice).toMatchObject({
      requiresConfirmation: true,
      dataLeftBehind: true,
      actions: ['export_first', 'continue'],
    });
    expect(advice.headline).toContain('12 subscriptions');
    // The whole point of the fix: the user must be told nothing is deleted.
    expect(advice.detail).toMatch(/not uploaded|not deleted/);
    expect(advice.detail).toMatch(/switching back/i);
    expect(advice.detail.toLowerCase()).toContain('export');
  });

  it('does not warn about an empty local scope', () => {
    expect(assessModeTransition({ from: 'local', to: 'supabase', itemCount: 0 })).toMatchObject({
      requiresConfirmation: false,
      dataLeftBehind: false,
    });
  });

  it('warns in both directions between local and demo', () => {
    expect(assessModeTransition({ from: 'local', to: 'demo', itemCount: 3 })).toMatchObject({
      requiresConfirmation: true,
      dataLeftBehind: true,
    });
    expect(assessModeTransition({ from: 'demo', to: 'local', itemCount: 8 })).toMatchObject({
      requiresConfirmation: true,
      dataLeftBehind: true,
    });
  });

  it('does not warn when leaving cloud — the rows come back on sign-in', () => {
    expect(assessModeTransition({ from: 'supabase', to: 'local', itemCount: 20 })).toMatchObject({
      requiresConfirmation: false,
      dataLeftBehind: false,
    });
  });

  it('pluralises honestly for a single subscription', () => {
    const advice = assessModeTransition({ from: 'local', to: 'supabase', itemCount: 1 });
    expect(advice.headline).toContain('1 subscription');
    expect(advice.headline).not.toContain('1 subscriptions');
  });
});
