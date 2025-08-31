ALTER TABLE restaurantes
ADD COLUMN mp_access_token VARCHAR(255) NULL,
ADD COLUMN mp_refresh_token VARCHAR(255) NULL,
ADD COLUMN mp_user_id VARCHAR(100) NULL;