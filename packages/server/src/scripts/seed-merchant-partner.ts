/**
 * 写入已入驻演示商户账号（幂等）。
 *
 * 用法：pnpm --filter @douxing/server db:seed-merchant
 */
import '../config/env.js';
import { ensureDatabase } from '../db/ensure-database.js';
import { seedDefaultRoleMenus, syncMissingMenusFromSeed } from '../services/sys-admin.service.js';
import { ensureMerchantRoleSeed } from '../services/marketplace/marketplace-merchant-role.service.js';
import {
  MERCHANT_DEMO_PASSWORD,
  MERCHANT_DEMO_USERNAME,
  seedMerchantPartnerUser,
} from '../services/marketplace/marketplace-seed.service.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  await ensureDatabase(url);
  await ensureMerchantRoleSeed();
  await syncMissingMenusFromSeed();
  await seedDefaultRoleMenus();

  const result = await seedMerchantPartnerUser();
  if (!result) {
    console.log('[seed-merchant] 未创建演示商户（可能为生产环境）');
    process.exit(0);
  }

  console.log('[seed-merchant] 完成');
  console.log(`  账号：${MERCHANT_DEMO_USERNAME}`);
  console.log(`  密码：${MERCHANT_DEMO_PASSWORD}`);
  console.log(`  用户 ID：${result.userId}`);
  console.log(`  商户 ID：${result.orgId}`);
  console.log('  登录：Web 管理端 → 登录页选择商户入口，或直接访问 /login?portal=partner');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-merchant] 失败:', err);
  process.exit(1);
});
