/**
 * Android backup policy — a deliberate, documented decision (audit S-06).
 *
 * DECISION: Leakify's data is EXCLUDED from Android Auto Backup / device
 * transfer (`android:allowBackup="false"`).
 *
 * Why: local-mode data (subscriptions, amounts, billing history, reminder
 * bookkeeping) is stored in AsyncStorage, which is unencrypted. Auto Backup
 * would copy it into the user's Google account, outside the privacy promise
 * this app makes. Turning backup off keeps the data inside the app sandbox.
 *
 * The trade-off, stated plainly: a user who reinstalls or moves to a new phone
 * loses their local data. That is what Settings → "Export my data" and the JSON
 * restore path are for. If this is ever flipped to `true`, ship
 * `android:dataExtractionRules` with an exclusion for the `leakify.*`
 * preferences at the same time, and update README + SECURITY.md.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

/** Flip this to re-enable Android Auto Backup (read the header first). */
const ALLOW_BACKUP = false;

/**
 * Pure manifest edit, exported so it can be unit-tested without prebuild.
 * `manifest` is the parsed AndroidManifest.xml object Expo hands the mod.
 */
function setAllowBackup(manifest, allow) {
  const application = manifest?.manifest?.application?.[0];
  if (!application) return manifest;
  application.$ = application.$ ?? {};
  application.$['android:allowBackup'] = allow ? 'true' : 'false';
  if (!allow) {
    // Backup-rule attributes are meaningless (and confusing) with backup off.
    delete application.$['android:dataExtractionRules'];
    delete application.$['android:fullBackupContent'];
  }
  return manifest;
}

function withAndroidBackupPolicy(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = setAllowBackup(cfg.modResults, ALLOW_BACKUP);
    return cfg;
  });
}

module.exports = withAndroidBackupPolicy;
module.exports.setAllowBackup = setAllowBackup;
module.exports.ALLOW_BACKUP = ALLOW_BACKUP;
