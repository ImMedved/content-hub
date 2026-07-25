CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email_hash VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE role (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users_role (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_users_role_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_role_role FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE
);

CREATE TABLE session (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_user_id ON session (user_id);

CREATE TABLE direct_message (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    CONSTRAINT chk_direct_message_not_self CHECK (sender_id <> recipient_id),
    CONSTRAINT fk_direct_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_direct_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_direct_message_sender_recipient ON direct_message (sender_id, recipient_id, id);
CREATE INDEX idx_direct_message_recipient_read ON direct_message (recipient_id, read_at, id);

INSERT INTO role (name) VALUES
('user'),
('author'),
('admin');

CREATE TABLE post (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL,
    post_kind VARCHAR(30) NOT NULL DEFAULT 'post',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    preview_url VARCHAR(255),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    original_post_id BIGINT,
    is_repost BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_post_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_original FOREIGN KEY (original_post_id) REFERENCES post(id) ON DELETE SET NULL
);

CREATE INDEX idx_post_kind_author_created ON post (post_kind, author_id, created_at DESC);

CREATE TABLE post_content (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_url VARCHAR(255),
    text_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_post_content_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE image_asset (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL UNIQUE,
    owner_id BIGINT NOT NULL,
    original_url VARCHAR(255) NOT NULL,
    compressed_url VARCHAR(255),
    thumbnail_url VARCHAR(255),
    feed_thumbnail_url VARCHAR(255),
    original_storage_key VARCHAR(255),
    compressed_storage_key VARCHAR(255),
    thumbnail_storage_key VARCHAR(255),
    feed_thumbnail_storage_key VARCHAR(255),
    processing_status VARCHAR(30) NOT NULL DEFAULT 'queued',
    analysis_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    analysis_payload JSONB,
    ocr_text TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_image_asset_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE,
    CONSTRAINT fk_image_asset_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_image_asset_owner_created ON image_asset (owner_id, created_at DESC);
CREATE INDEX idx_image_asset_ocr ON image_asset USING GIN (to_tsvector('simple', COALESCE(ocr_text, '')));

CREATE TABLE tag (
    id BIGSERIAL PRIMARY KEY,
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
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reaction (
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_reaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reaction_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE follow (
    follower_id BIGINT NOT NULL,
    following_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_follow_not_self CHECK (follower_id <> following_id),
    CONSTRAINT fk_follow_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_follow_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE feed_event (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_feed_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_feed_event_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE post_access (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    access_type VARCHAR(30) NOT NULL DEFAULT 'free',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_post_access_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE wallet (
    user_id BIGINT PRIMARY KEY,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_wallet_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payment_transaction (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    related_user_id BIGINT,
    post_id BIGINT,
    type VARCHAR(20) NOT NULL,
    commission DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payment_transaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_transaction_related_user FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_transaction_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE SET NULL
);

CREATE TABLE access_grant (
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_access_grant_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_access_grant_post FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE,
    CONSTRAINT fk_access_grant_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transaction(id) ON DELETE CASCADE
);

CREATE TABLE moderation_action (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    target_user_id BIGINT,
    target_post_id BIGINT,
    target_comment_id BIGINT,
    action_type VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_moderation_action_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_moderation_action_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_moderation_action_target_post FOREIGN KEY (target_post_id) REFERENCES post(id) ON DELETE SET NULL,
    CONSTRAINT fk_moderation_action_target_comment FOREIGN KEY (target_comment_id) REFERENCES comment(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_post_updated_at
BEFORE UPDATE ON post
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_image_asset_updated_at
BEFORE UPDATE ON image_asset
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comment_updated_at
BEFORE UPDATE ON comment
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_wallet_updated_at
BEFORE UPDATE ON wallet
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
