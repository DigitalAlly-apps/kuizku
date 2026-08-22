const LEGACY_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['ujianly_wizard_draft', 'kuizku_wizard_draft'],
  ['ujianly_pending_submission_queue', 'kuizku_pending_submission_queue'],
  ['ujianly_student_history', 'kuizku_student_history'],
];

const LEGACY_SESSION_PREFIXES = ['ujianly_session_', 'kk_session_'];
const SESSION_PREFIX = 'kuizku_session_';
const MIGRATION_MARKER = 'kuizku_brand_migration_v1';

export function migrateLegacyBrandStorage(): void {
  try {
    if (localStorage.getItem(MIGRATION_MARKER)) return;

    for (const [legacyKey, currentKey] of LEGACY_KEYS) {
      if (localStorage.getItem(currentKey) === null) {
        const value = localStorage.getItem(legacyKey);
        if (value !== null) localStorage.setItem(currentKey, value);
      }
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const legacyKey = localStorage.key(index);
      if (!legacyKey) continue;
      const prefix = LEGACY_SESSION_PREFIXES.find(candidate => legacyKey.startsWith(candidate));
      if (!prefix) continue;
      const currentKey = `${SESSION_PREFIX}${legacyKey.slice(prefix.length)}`;
      if (localStorage.getItem(currentKey) === null) {
        const value = localStorage.getItem(legacyKey);
        if (value !== null) localStorage.setItem(currentKey, value);
      }
    }

    localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
