-- C7-b：规划 Agent 状态
ALTER TABLE `plan_sessions`
  ADD COLUMN `agent_state` JSON NULL AFTER `intent_snapshot`;
