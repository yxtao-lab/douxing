CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_no` varchar(32) NOT NULL,
	`user_id` int NOT NULL,
	`order_type` varchar(32) NOT NULL,
	`product_id` int NOT NULL,
	`product_name` varchar(200) NOT NULL,
	`total_amount` decimal(10,2) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`product_snapshot` json,
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_no_unique` UNIQUE(`order_no`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
