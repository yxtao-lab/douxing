CREATE TABLE `refresh_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp,
  `user_agent` varchar(512),
  `ip` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uk_refresh_tokens_token_hash` ON `refresh_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user_id` ON `refresh_tokens` (`user_id`);
