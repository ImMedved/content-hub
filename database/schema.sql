DROP TABLE IF EXISTS moderation_action;
DROP TABLE IF EXISTS access_grant;
DROP TABLE IF EXISTS payment_transaction;
DROP TABLE IF EXISTS wallet;
DROP TABLE IF EXISTS feed_event;
DROP TABLE IF EXISTS post_tag;
DROP TABLE IF EXISTS tag;
DROP TABLE IF EXISTS reaction;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS follow;
DROP TABLE IF EXISTS post_access;
DROP TABLE IF EXISTS post_content;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS direct_message;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS users_role;
DROP TABLE IF EXISTS role;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email_hash VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT NULL,
    avatar_url VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL
);

CREATE TABLE role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users_role (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_users_role_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_users_role_role FOREIGN KEY (role_id) REFERENCES role(id)
);

CREATE TABLE session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 DAY),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_user_id (user_id),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE direct_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_direct_message_sender_recipient (sender_id, recipient_id, id),
    INDEX idx_direct_message_recipient_read (recipient_id, read_at, id),
    CONSTRAINT chk_direct_message_not_self CHECK (sender_id <> recipient_id),
    CONSTRAINT fk_direct_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_direct_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO role (name) VALUES
('user'),
('author'),
('admin');

CREATE TABLE post (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    author_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    preview_url VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at DATETIME NULL,
    original_post_id BIGINT NULL,
    is_repost BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_post_author FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT fk_post_original FOREIGN KEY (original_post_id) REFERENCES post(id)
);

CREATE TABLE post_content (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_url VARCHAR(255) NULL,
    text_content TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_content_post FOREIGN KEY (post_id) REFERENCES post(id)
);

CREATE TABLE tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE post_tag (
    post_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    CONSTRAINT fk_post_tag_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_tag_tag FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
);

CREATE TABLE comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES post(id),
    CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE reaction (
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'like',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_reaction_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_reaction_post FOREIGN KEY (post_id) REFERENCES post(id)
);

CREATE TABLE follow (
    follower_id BIGINT NOT NULL,
    following_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_follow_not_self CHECK (follower_id <> following_id),
    CONSTRAINT fk_follow_follower FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT fk_follow_following FOREIGN KEY (following_id) REFERENCES users(id)
);

CREATE TABLE feed_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feed_event_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_feed_event_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE post_access (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    access_type VARCHAR(30) NOT NULL DEFAULT 'free',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_access_post FOREIGN KEY (post_id) REFERENCES post(id)
);

CREATE TABLE wallet (
    user_id BIGINT PRIMARY KEY,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_wallet_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payment_transaction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    related_user_id BIGINT NULL,
    post_id BIGINT NULL,
    type VARCHAR(20) NOT NULL,
    commission DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_transaction_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_payment_transaction_related_user FOREIGN KEY (related_user_id) REFERENCES users(id),
    CONSTRAINT fk_payment_transaction_post FOREIGN KEY (post_id) REFERENCES post(id)
);

CREATE TABLE access_grant (
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_access_grant_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_access_grant_post FOREIGN KEY (post_id) REFERENCES post(id),
    CONSTRAINT fk_access_grant_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transaction(id)
);

CREATE TABLE moderation_action (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    target_user_id BIGINT NULL,
    target_post_id BIGINT NULL,
    target_comment_id BIGINT NULL,
    action_type VARCHAR(50) NOT NULL,
    reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_moderation_action_admin FOREIGN KEY (admin_id) REFERENCES users(id),
    CONSTRAINT fk_moderation_action_target_user FOREIGN KEY (target_user_id) REFERENCES users(id),
    CONSTRAINT fk_moderation_action_target_post FOREIGN KEY (target_post_id) REFERENCES post(id),
    CONSTRAINT fk_moderation_action_target_comment FOREIGN KEY (target_comment_id) REFERENCES comment(id)
);
