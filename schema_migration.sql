-- ============================================
-- CRIMSON AUTOMATION SCHEMA MIGRATION
-- ============================================
-- This script creates a separate 'automation' schema for the Dev-E-Auto worker
-- to avoid table name collisions with Crimson UI-Backend tables in the 'public' schema.
--
-- Run this script against your Crimson PostgreSQL database (Port 5432):
-- psql -U postgres -d crimson -f schema_migration.sql
-- ============================================

-- Create automation schema
CREATE SCHEMA IF NOT EXISTS automation;

-- Set search_path for this session
SET search_path TO automation, public;

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Note: This is separate from Crimson's public.User table
-- Used for bot/trap engagement tracking
CREATE TABLE IF NOT EXISTS automation.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  reminders_sent INT DEFAULT 0,
  active BOOLEAN DEFAULT FALSE,
  name TEXT,
  password TEXT, -- Removed by auth refactor, kept for schema compatibility
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role TEXT DEFAULT 'visitor' CHECK (role IN ('admin', 'partner', 'visitor')),
  magic_token TEXT,
  magic_token_expires TIMESTAMP WITH TIME ZONE,
  badge TEXT -- Reward badge
);

-- ============================================
-- 2. POST QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT,
  media_url TEXT,
  caption TEXT,
  priority INT DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  retries INT DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. ENGAGEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES automation.post_queue(id) ON DELETE CASCADE,
  platform TEXT,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  views INT DEFAULT 0,
  user_id UUID REFERENCES automation.users(id) ON DELETE SET NULL,
  reward_triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. BLOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  image_urls TEXT[],
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published BOOLEAN DEFAULT FALSE,
  author_id UUID REFERENCES automation.users(id) ON DELETE SET NULL
);

-- ============================================
-- 5. GENERATED POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  platform TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. LOGGING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT,
  message TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES automation.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('reward', 'engagement', 'system', 'custom')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. REWARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES automation.users(id) ON DELETE SET NULL,
  post_id UUID REFERENCES automation.post_queue(id) ON DELETE CASCADE,
  reward_type TEXT CHECK (reward_type IN ('silver', 'gold', 'viral')),
  amount NUMERIC DEFAULT 0,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  notified BOOLEAN DEFAULT FALSE
);

-- ============================================
-- 9. LEADERBOARD TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES automation.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for leaderboard
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON automation.leaderboard(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_position ON automation.leaderboard(position);

-- ============================================
-- 10. ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- ============================================
-- 11. PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT
);

-- ============================================
-- 12. ROLE_PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.role_permissions (
  role_id UUID REFERENCES automation.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES automation.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- 13. USER_ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.user_roles (
  user_id UUID REFERENCES automation.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES automation.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- 14. BOT_STATUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.bot_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error')),
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 15. SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS automation.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SEED DATA: Roles
-- ============================================
INSERT INTO automation.roles (id, name, description)
SELECT gen_random_uuid(), r.name, r.description
FROM (VALUES
  ('admin','Full administrative access'),
  ('partner','Limited access to own data'),
  ('visitor','Captured user, minimal access')
) AS r(name, description)
WHERE NOT EXISTS (SELECT 1 FROM automation.roles WHERE name = r.name);

-- ============================================
-- SEED DATA: Permissions
-- ============================================
INSERT INTO automation.permissions (id, code, description)
SELECT gen_random_uuid(), p.code, p.description
FROM (VALUES
  ('dashboard.view','View dashboard'),
  ('users.manage','Manage users'),
  ('bots.manage','Run and manage bots'),
  ('rewards.manage','Manage rewards'),
  ('posts.write','Create and schedule posts'),
  ('posts.read','Read posts queue'),
  ('settings.manage','Change system settings'),
  ('logs.read','Read system logs')
) AS p(code, description)
WHERE NOT EXISTS (SELECT 1 FROM automation.permissions WHERE code = p.code);

-- ============================================
-- SEED DATA: Map admin role to all permissions
-- ============================================
INSERT INTO automation.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM automation.roles r, automation.permissions p
WHERE r.name = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM automation.role_permissions rp 
  WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ============================================
-- SEED DATA: Map partner role to limited permissions
-- ============================================
INSERT INTO automation.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM automation.roles r, automation.permissions p
WHERE r.name = 'partner' 
AND p.code IN ('dashboard.view','posts.write','posts.read','logs.read')
AND NOT EXISTS (
  SELECT 1 FROM automation.role_permissions rp 
  WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Trigger function for engagement rewards
CREATE OR REPLACE FUNCTION automation.handle_engagement_insert()
RETURNS TRIGGER AS $$
DECLARE
  total_engagements INT;
BEGIN
  total_engagements := NEW.likes + NEW.shares + NEW.comments + NEW.views;

  -- Silver reward at 100 engagements
  IF total_engagements >= 100 AND NEW.reward_triggered = FALSE THEN
    UPDATE automation.engagements
    SET reward_triggered = TRUE
    WHERE id = NEW.id;

    INSERT INTO automation.rewards (user_id, post_id, reward_type, amount)
    VALUES (NEW.user_id, NEW.post_id, 'silver', 10);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS engagement_reward_trigger ON automation.engagements;
CREATE TRIGGER engagement_reward_trigger
  AFTER INSERT OR UPDATE ON automation.engagements
  FOR EACH ROW
  EXECUTE PROCEDURE automation.handle_engagement_insert();

-- ============================================
-- RPC FUNCTION: Award tokens if needed
-- ============================================
CREATE OR REPLACE FUNCTION automation.award_tokens_if_needed(
  input_post_id UUID,
  input_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  total_engagement INT;
  result JSONB;
BEGIN
  -- Calculate total engagement
  SELECT COALESCE(SUM(likes + shares + comments + views), 0)
  INTO total_engagement
  FROM automation.engagements
  WHERE post_id = input_post_id AND user_id = input_user_id;

  -- Check thresholds and award
  IF total_engagement >= 1000 THEN
    INSERT INTO automation.rewards (user_id, post_id, reward_type, amount)
    VALUES (input_user_id, input_post_id, 'gold', 50)
    ON CONFLICT DO NOTHING;
    
    result := jsonb_build_object('awarded', true, 'type', 'gold', 'amount', 50);
  ELSIF total_engagement >= 100 THEN
    INSERT INTO automation.rewards (user_id, post_id, reward_type, amount)
    VALUES (input_user_id, input_post_id, 'silver', 10)
    ON CONFLICT DO NOTHING;
    
    result := jsonb_build_object('awarded', true, 'type', 'silver', 'amount', 10);
  ELSE
    result := jsonb_build_object('awarded', false);
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC FUNCTION: Get platform engagement stats
-- ============================================
CREATE OR REPLACE FUNCTION automation.get_platform_engagement_stats()
RETURNS TABLE (
  platform TEXT,
  total_posts BIGINT,
  total_likes BIGINT,
  total_shares BIGINT,
  total_comments BIGINT,
  total_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.platform,
    COUNT(DISTINCT e.post_id) AS total_posts,
    SUM(e.likes) AS total_likes,
    SUM(e.shares) AS total_shares,
    SUM(e.comments) AS total_comments,
    SUM(e.views) AS total_views
  FROM automation.engagements e
  GROUP BY e.platform;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC FUNCTION: Get reward stats by type
-- ============================================
CREATE OR REPLACE FUNCTION automation.get_reward_stats_by_type()
RETURNS TABLE (
  reward_type TEXT,
  total_count BIGINT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.reward_type,
    COUNT(*) AS total_count,
    SUM(r.amount) AS total_amount
  FROM automation.rewards r
  GROUP BY r.reward_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant usage on schema to your application user
-- Replace 'crimson_user' with your actual database user
-- GRANT USAGE ON SCHEMA automation TO crimson_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA automation TO crimson_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA automation TO crimson_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA automation TO crimson_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Verify the migration:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'automation';
