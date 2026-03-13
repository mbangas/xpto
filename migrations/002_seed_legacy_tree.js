/**
 * migrations/002_seed_legacy_tree.js
 *
 * Seeds the system user and legacy default tree so that backward-compatible
 * calls using LEGACY_TREE_ID have a valid FK target in the trees table.
 */
'use strict';

const SYSTEM_USER_ID  = '00000000-0000-0000-0000-000000000001';
const LEGACY_TREE_ID  = '00000000-0000-0000-0000-000000000000';

module.exports = {
  async up(pool) {
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, is_admin)
        VALUES ($1, 'system@localhost', '!locked', 'System', FALSE)
        ON CONFLICT (id) DO NOTHING;
    `, [SYSTEM_USER_ID]);

    await pool.query(`
      INSERT INTO trees (id, name, description, owner_id)
        VALUES ($1, 'Default', 'Legacy single-tenant tree', $2)
        ON CONFLICT (id) DO NOTHING;
    `, [LEGACY_TREE_ID, SYSTEM_USER_ID]);
  },

  async down(pool) {
    await pool.query(`DELETE FROM trees WHERE id = $1`, [LEGACY_TREE_ID]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [SYSTEM_USER_ID]);
  },
};
