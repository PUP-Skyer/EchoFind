import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const base = new URL('../client/src/pages/Management/', import.meta.url);
const source = name => existsSync(new URL(name, base)) ? readFileSync(new URL(name, base), 'utf8') : '';
test('管理界面具备明确演示入口和数据隔离提示', () => {
  const ui = source('index.tsx');
  assert.ok(ui.includes('演示'), '缺少演示边界');
  assert.ok(ui.includes('进入演示工作台'), '缺少登录演示入口');
  assert.ok(ui.includes('未连接真实飞书'), '缺少真实数据状态');
});
test('用户更新和筛选复用经过测试的数据模型', () => {
  const ui = source('index.tsx');
  assert.match(ui, /filterAccounts\(/);
  assert.match(ui, /updateAccount\(/);
  assert.ok(ui.includes('dialog'), '操作须有可访问对话框');
});
test('主题隔离且考虑窄屏和减少动效', () => {
  const css = source('management.css');
  assert.match(css, /\.ef-admin/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media/);
});
test('管理路由和原有业务路由共存', () => {
  const ui = readFileSync(fileURLToPath(new URL('../client/src/app.tsx', import.meta.url)), 'utf8');
  assert.ok(ui.includes('management/*'), '缺少独立管理路由');
  assert.ok(ui.includes('path="dashboard"'));
  assert.ok(ui.includes('path="items"'));
});
