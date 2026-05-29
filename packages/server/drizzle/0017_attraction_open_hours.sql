-- H9-3：景点开放时长
ALTER TABLE `attractions` ADD COLUMN `open_hours` json NULL;

-- 种子景点开放时长（新装与已有库均可执行）
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:00","close":"17:30"}]}' WHERE `name` = '雷峰塔';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"07:30","close":"17:30"}]}' WHERE `name` = '灵隐寺';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"17:00"}]}' WHERE `name` = '西溪湿地';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"16:00"}],"closedWeekdays":[1]}' WHERE `name` = '浙江科技馆';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"16:30"}]}' WHERE `name` = '杭州野生动物世界';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"09:00","close":"17:00"}],"closedWeekdays":[1]}' WHERE `name` = '上海博物馆';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"16:30"}]}' WHERE `name` = '豫园';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:30","close":"17:00"}],"closedWeekdays":[1]}' WHERE `name` = '故宫博物院';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"08:00","close":"17:00"}]}' WHERE `name` = '慕田峪长城';
UPDATE `attractions` SET `open_hours` = '{"windows":[{"open":"07:30","close":"17:30"}]}' WHERE `name` = '大熊猫繁育研究基地';
