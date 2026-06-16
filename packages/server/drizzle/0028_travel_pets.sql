-- H3-a：AI 旅行宠物与结构化记忆
CREATE TABLE IF NOT EXISTS `travel_pets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `species` varchar(32) NOT NULL DEFAULT 'fox',
  `nickname` varchar(64) NOT NULL DEFAULT '',
  `personality` varchar(32) NOT NULL DEFAULT 'guide',
  `level` int NOT NULL DEFAULT 1,
  `exp` int NOT NULL DEFAULT 0,
  `mood` varchar(16) NOT NULL DEFAULT 'happy',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_travel_pets_user` (`user_id`),
  CONSTRAINT `fk_travel_pets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pet_memories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `pet_id` int NULL,
  `memory_type` varchar(32) NOT NULL,
  `content` text NOT NULL,
  `metadata` json NULL,
  `importance` tinyint NOT NULL DEFAULT 5,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pet_memories_user` (`user_id`),
  KEY `idx_pet_memories_type` (`memory_type`),
  CONSTRAINT `fk_pet_memories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pet_memories_pet` FOREIGN KEY (`pet_id`) REFERENCES `travel_pets` (`id`) ON DELETE SET NULL
);
