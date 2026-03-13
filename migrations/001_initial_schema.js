/**
 * migrations/001_initial_schema.js — Initial multi-tenant schema for myLineage.
 *
 * Tables:
 *   users, trees, tree_memberships, invitations, notifications,
 *   genealogy_records, tree_settings, tree_history, login_audit
 */

'use strict';

module.exports = {
  async up(pool) {
    await pool.query(`
      /* ── Extension for UUID generation ──────────────────────────────────── */
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      /* ── users ──────────────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS users (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        email          VARCHAR(255) NOT NULL UNIQUE,
        password_hash  VARCHAR(255) NOT NULL,
        name           VARCHAR(255) NOT NULL DEFAULT '',
        totp_secret    VARCHAR(64),
        totp_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
        is_admin       BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      /* ── trees ─────────────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS trees (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        description TEXT         NOT NULL DEFAULT '',
        owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      /* ── tree_memberships ──────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS tree_memberships (
        id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id   UUID        NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
        user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role      VARCHAR(10) NOT NULL CHECK (role IN ('owner','writer','reader')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tree_id, user_id)
      );

      /* ── invitations ───────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS invitations (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id        UUID         NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
        inviter_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_email  VARCHAR(255) NOT NULL,
        role           VARCHAR(10)  NOT NULL CHECK (role IN ('writer','reader')),
        status         VARCHAR(10)  NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','accepted','declined','expired')),
        token          VARCHAR(128) NOT NULL UNIQUE,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        expires_at     TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        responded_at   TIMESTAMPTZ
      );

      /* ── notifications ─────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       VARCHAR(50) NOT NULL,
        data       JSONB       NOT NULL DEFAULT '{}',
        read       BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      /* ── genealogy_records ─────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS genealogy_records (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id     UUID         NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
        collection  VARCHAR(50)  NOT NULL,
        entity_id   VARCHAR(50)  NOT NULL,
        data        JSONB        NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        UNIQUE (tree_id, collection, entity_id)
      );

      /* ── tree_settings ─────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS tree_settings (
        tree_id UUID        NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
        key     VARCHAR(100) NOT NULL,
        value   JSONB        NOT NULL DEFAULT '{}',
        PRIMARY KEY (tree_id, key)
      );

      /* ── tree_history ──────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS tree_history (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id    UUID        NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
        data       JSONB       NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      /* ── login_audit ───────────────────────────────────────────────────── */
      CREATE TABLE IF NOT EXISTS login_audit (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
        ip         VARCHAR(45),
        user_agent VARCHAR(512),
        success    BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      /* ── Indexes ───────────────────────────────────────────────────────── */
      CREATE INDEX IF NOT EXISTS idx_genealogy_tree_collection
        ON genealogy_records (tree_id, collection);

      CREATE INDEX IF NOT EXISTS idx_genealogy_tree_collection_entity
        ON genealogy_records (tree_id, collection, entity_id);

      CREATE INDEX IF NOT EXISTS idx_tree_memberships_user
        ON tree_memberships (user_id);

      CREATE INDEX IF NOT EXISTS idx_invitations_token
        ON invitations (token);

      CREATE INDEX IF NOT EXISTS idx_invitations_email_status
        ON invitations (invitee_email, status);

      CREATE INDEX IF NOT EXISTS idx_notifications_user_read
        ON notifications (user_id, read);

      CREATE INDEX IF NOT EXISTS idx_tree_history_tree
        ON tree_history (tree_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_login_audit_user
        ON login_audit (user_id, created_at DESC);

      /* ── Seed: system user & legacy default tree ───────────────────────── */
      INSERT INTO users (id, email, password_hash, name, is_admin)
        VALUES (
          '00000000-0000-0000-0000-000000000001',
          'system@localhost',
          '!locked',
          'System',
          FALSE
        ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO trees (id, name, description, owner_id)
        VALUES (
          '00000000-0000-0000-0000-000000000000',
          'Default',
          'Legacy single-tenant tree',
          '00000000-0000-0000-0000-000000000001'
        ) ON CONFLICT (id) DO NOTHING;
    `);
  },

  async down(pool) {
    await pool.query(`
      DROP TABLE IF EXISTS login_audit       CASCADE;
      DROP TABLE IF EXISTS tree_history       CASCADE;
      DROP TABLE IF EXISTS tree_settings      CASCADE;
      DROP TABLE IF EXISTS genealogy_records  CASCADE;
      DROP TABLE IF EXISTS notifications      CASCADE;
      DROP TABLE IF EXISTS invitations        CASCADE;
      DROP TABLE IF EXISTS tree_memberships   CASCADE;
      DROP TABLE IF EXISTS trees              CASCADE;
      DROP TABLE IF EXISTS users              CASCADE;
    `);
  },
};
