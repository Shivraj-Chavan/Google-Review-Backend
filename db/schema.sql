-- ============================================================
-- Google Review Booster SaaS — MySQL Schema
-- Run:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS review_booster
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE review_booster;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id       VARCHAR(255) NULL,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(255) NULL,           -- only used for ADMIN accounts created manually
  profile_image   VARCHAR(500) NULL,
  role            ENUM('BUSINESS_USER','ADMIN') NOT NULL DEFAULT 'BUSINESS_USER',
  status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_google_id (google_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- businesses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  business_name      VARCHAR(190) NOT NULL,
  slug               VARCHAR(220) NOT NULL,
  description        TEXT NULL,
  category           VARCHAR(120) NULL,
  phone              VARCHAR(30) NULL,
  email              VARCHAR(190) NULL,
  address            VARCHAR(255) NULL,
  city               VARCHAR(120) NULL,
  state              VARCHAR(120) NULL,
  pincode            VARCHAR(20) NULL,
  website            VARCHAR(255) NULL,
  google_review_url  VARCHAR(500) NULL,
  instagram_url      VARCHAR(500) NULL,
  youtube_url        VARCHAR(500) NULL,
  facebook_url       VARCHAR(500) NULL,
  logo               VARCHAR(500) NULL,
  status             ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'INACTIVE',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_businesses_slug (slug),
  KEY idx_businesses_user (user_id),
  KEY idx_businesses_status (status),
  CONSTRAINT fk_businesses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- business_images (gallery, logo lives on businesses.logo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_images (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id    INT UNSIGNED NOT NULL,
  image_url      VARCHAR(500) NOT NULL,
  display_order  INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary     TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_business_images_business (business_id),
  CONSTRAINT fk_images_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- business_analytics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_analytics (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  event_type  ENUM('PAGE_VIEW','REVIEW_GENERATED','REVIEW_COPIED','GOOGLE_CLICK','QR_SCAN') NOT NULL,
  ip_hash     VARCHAR(64) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_analytics_business (business_id),
  KEY idx_analytics_event (event_type),
  CONSTRAINT fk_analytics_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Seed a master admin (email/password login, password: Admin@123)
-- Password hash below is bcrypt for "Admin@123" — change immediately after first login.
-- ------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, status)
VALUES ('Master Admin', 'admin@reviewbooster.app',
  '$2b$10$W3eWlUaAIrrv2ZU4awq7Cu6q8Uz629f69G/QOlT3AXypAglIZzQmq', 'ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE email = email;
