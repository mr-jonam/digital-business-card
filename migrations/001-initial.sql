CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','editor') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  totp_secret TEXT NULL,
  totp_counter BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  owner_id CHAR(36) NULL,
  draft JSON NOT NULL,
  published JSON NULL,
  published_recipient VARCHAR(254) NULL,
  version INT NOT NULL DEFAULT 1,
  revision INT NOT NULL DEFAULT 0,
  status ENUM('draft','published','suspended') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS revisions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  revision INT NOT NULL,
  snapshot JSON NOT NULL,
  actor_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY revision_number (profile_id, revision),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS web_sessions (
  id CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NULL,
  payload MEDIUMTEXT NOT NULL,
  expires BIGINT NOT NULL,
  INDEX expiry (expires),
  INDEX account (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket CHAR(64) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 1,
  expires BIGINT NOT NULL,
  INDEX expiry (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inquiries (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  submission_id CHAR(36) NOT NULL UNIQUE,
  kind ENUM('callback','message') NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(254) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id),
  INDEX inbox (profile_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outbox (
  id CHAR(36) PRIMARY KEY,
  inquiry_id CHAR(36) NOT NULL UNIQUE,
  recipient VARCHAR(254) NOT NULL,
  status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  available_at BIGINT NOT NULL,
  lease_until BIGINT NOT NULL DEFAULT 0,
  lease_token CHAR(36) NULL,
  last_error VARCHAR(80) NULL,
  sent_at TIMESTAMP NULL,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE,
  INDEX delivery (status, available_at, lease_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(60) NOT NULL,
  subject_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
