-- H9-3：景点开放时长
ALTER TABLE `attractions` ADD COLUMN `open_hours` json NULL;
--> statement-breakpoint
-- 种子景点开放时长（新装与已有库均可执行）
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:00","close":"17:30"}]}' WHERE `name` = '雷峰塔';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"07:30","close":"17:30"}]}' WHERE `name` = '灵隐寺';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"17:00"}]}' WHERE `name` = '西溪湿地';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"16:00"}],"closedWeekdays":[1]}' WHERE `name` = '浙江科技馆';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"16:30"}]}' WHERE `name` = '杭州野生动物世界';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"17:00"}],"closedWeekdays":[1]}' WHERE `name` = '上海博物馆';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"16:30"}]}' WHERE `name` = '豫园';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"17:00"}],"closedWeekdays":[1]}' WHERE `name` = '故宫博物院';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:00","close":"17:00"}]}' WHERE `name` = '慕田峪长城';
--> statement-breakpoint
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"07:30","close":"17:30"}]}' WHERE `name` = '大熊猫繁育研究基地';
