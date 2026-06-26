CREATE TABLE `role_menu` (
	`role_id` int NOT NULL,
	`menu_id` int NOT NULL,
	CONSTRAINT `role_menu_role_id_menu_id_pk` PRIMARY KEY(`role_id`,`menu_id`)
);
--> statement-breakpoint
ALTER TABLE `role_menu` ADD CONSTRAINT `role_menu_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `role_menu` ADD CONSTRAINT `role_menu_menu_id_sys_menu_id_fk` FOREIGN KEY (`menu_id`) REFERENCES `sys_menu`(`id`) ON DELETE cascade ON UPDATE no action;
