/**
 * The Android backup decision is a one-line manifest attribute with a real
 * privacy consequence, so it is pinned by a test rather than by memory.
 */
/** The slice of a parsed AndroidManifest.xml that the plugin touches. */
interface TestManifest {
  manifest: { application?: { $?: Record<string, string> }[] };
}

const manifest = (): TestManifest => ({
  manifest: {
    application: [
      {
        $: {
          'android:name': '.MainApplication',
          'android:allowBackup': 'true',
          'android:dataExtractionRules': '@xml/data_extraction_rules',
        },
      },
    ],
  },
});

// The plugin is CommonJS because Expo resolves local config plugins with require().
/* eslint-disable @typescript-eslint/no-require-imports */
const plugin = require('../with-android-backup-policy') as {
  setAllowBackup: (m: TestManifest, allow: boolean) => TestManifest;
  ALLOW_BACKUP: boolean;
};
/* eslint-enable @typescript-eslint/no-require-imports */

describe('withAndroidBackupPolicy', () => {
  it('ships with Auto Backup disabled', () => {
    expect(plugin.ALLOW_BACKUP).toBe(false);
  });

  it('sets android:allowBackup=false', () => {
    const result = plugin.setAllowBackup(manifest(), plugin.ALLOW_BACKUP);
    expect(result.manifest.application?.[0].$?.['android:allowBackup']).toBe('false');
  });

  it('removes now-meaningless backup rule attributes', () => {
    const result = plugin.setAllowBackup(manifest(), false);
    const attrs = result.manifest.application?.[0].$ ?? {};
    expect(attrs['android:dataExtractionRules']).toBeUndefined();
    expect(attrs['android:fullBackupContent']).toBeUndefined();
    expect(attrs['android:name']).toBe('.MainApplication');
  });

  it('can be re-enabled without losing the rule attributes', () => {
    const result = plugin.setAllowBackup(manifest(), true);
    const attrs = result.manifest.application?.[0].$ ?? {};
    expect(attrs['android:allowBackup']).toBe('true');
    expect(attrs['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
  });

  it('tolerates a manifest with no <application> instead of throwing', () => {
    const empty: TestManifest = { manifest: {} };
    expect(() => plugin.setAllowBackup(empty, false)).not.toThrow();
  });
});
