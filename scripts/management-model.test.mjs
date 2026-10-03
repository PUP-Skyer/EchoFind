import test from 'node:test';
import assert from 'node:assert/strict';

const model = await import('../client/src/pages/Management/model.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const { demoAccounts, demoFeedback, filterAccounts, updateAccount, calculateMetrics, roleLabels, statusLabels } = model;
const account = (id, role = 'user', status = 'active') => ({ id, name: `昵称${id}`, email: `${id}@example.com`, role, status, createdAt: '2026-01-01T00:00:00.000Z', lastActive: null, channel: 'APP' });
const fixture = () => [account('u'), account('d', 'user', 'disabled'), account('a', 'admin'), account('s', 'superadmin'), account('x', 'superadmin', 'disabled')];
const reject = (accounts, id, patch, actor, message) => {
  const before = structuredClone(accounts);
  assert.throws(() => updateAccount(accounts, id, patch, actor), message);
  assert.deepEqual(accounts, before);
};

test('导出所需模型 API', () => {
  for (const key of ['demoAccounts', 'demoFeedback', 'filterAccounts', 'updateAccount', 'calculateMetrics', 'roleLabels', 'statusLabels']) assert.ok(key in model, `缺少 ${key}`);
});
test('24 个虚构账号具备完整字段和唯一 ID/邮箱', () => {
  assert.equal(demoAccounts.length, 24);
  assert.equal(new Set(demoAccounts.map(a => a.id)).size, 24);
  assert.equal(new Set(demoAccounts.map(a => a.email)).size, 24);
  for (const a of demoAccounts) {
    assert.ok(a.id && a.name.trim() && a.channel);
    assert.match(a.email, /@example\.com$/);
    assert.ok(['user', 'admin', 'superadmin'].includes(a.role));
    assert.ok(['active', 'disabled'].includes(a.status));
    assert.ok(Number.isFinite(Date.parse(a.createdAt)));
    assert.ok(a.lastActive === null || Number.isFinite(Date.parse(a.lastActive)));
  }
  assert.ok(demoAccounts.some(a => a.role === 'superadmin' && a.status === 'active'));
});
test('反馈覆盖所有状态、两种来源且字段完整', () => {
  assert.ok(demoFeedback.length > 0);
  assert.equal(new Set(demoFeedback.map(f => f.id)).size, demoFeedback.length);
  assert.deepEqual(new Set(demoFeedback.map(f => f.status)), new Set(['pending', 'processing', 'resolved']));
  assert.deepEqual(new Set(demoFeedback.map(f => f.source)), new Set(['APP', '网页']));
  for (const f of demoFeedback) for (const key of ['id', 'userName', 'subject', 'message', 'reply']) assert.equal(typeof f[key], 'string');
});
test('中文标签覆盖全部角色与账号状态', () => {
  assert.deepEqual(roleLabels, { user: '普通用户', admin: '管理员', superadmin: '超级管理员' });
  assert.deepEqual(statusLabels, { active: '正常', disabled: '已禁用' });
});
test('空条件返回所有账号且不修改输入', () => { const a = fixture(); assert.deepEqual(filterAccounts(a, ' ', 'all', 'all'), a); });
test('搜索昵称、邮箱、ID，忽略首尾空格及大小写', () => {
  const a = fixture();
  for (const query of [' 昵称u ', ' U@EXAMPLE.COM ', 'u']) assert.deepEqual(filterAccounts(a, query, 'all', 'all'), [a[0]]);
});
test('搜索、角色、状态共同生效，保持顺序', () => {
  const a = fixture(); const before = structuredClone(a);
  assert.deepEqual(filterAccounts(a, 'example', 'user', 'disabled'), [a[1]]);
  assert.deepEqual(filterAccounts(a, '', 'superadmin', 'all'), [a[3], a[4]]);
  assert.deepEqual(filterAccounts(a, '不存在', 'all', 'all'), []);
  assert.deepEqual(filterAccounts([], '', 'all', 'all'), []); assert.deepEqual(a, before);
});
test('普通用户和未知角色禁止管理', () => { for (const actor of ['user', 'unknown']) reject(fixture(), 'u', { name: '新昵称' }, actor, /权限/); });
test('admin 可修改普通账号且不修改原数组或对象', () => {
  const a = fixture(); const before = structuredClone(a);
  const result = updateAccount(a, 'u', { name: ' 新昵称 ', email: 'new@example.com', status: 'disabled' }, 'admin');
  assert.notEqual(result, a); assert.notEqual(result[0], a[0]); assert.deepEqual(a, before);
  assert.deepEqual(result[0], { ...a[0], name: '新昵称', email: 'new@example.com', status: 'disabled' }); assert.deepEqual(result.slice(1), a.slice(1));
});
test('admin 禁止提交角色字段，包括同值或 undefined', () => { for (const role of ['user', 'admin', 'superadmin', undefined]) reject(fixture(), 'u', { role }, 'admin', /角色/); });
test('admin 禁止管理任何管理员，包括禁用管理员', () => { for (const id of ['a', 's', 'x']) reject(fixture(), id, { name: '修改' }, 'admin', /管理员/); });
test('superadmin 可更改其他账号角色并管理管理员', () => {
  assert.equal(updateAccount(fixture(), 'u', { role: 'admin' }, 'superadmin')[0].role, 'admin');
  assert.equal(updateAccount(fixture(), 'a', { status: 'disabled' }, 'superadmin')[2].status, 'disabled');
});
test('最后活跃 superadmin 禁止降权或禁用，禁用同级不算备份', () => { for (const patch of [{ role: 'admin' }, { role: 'user' }, { status: 'disabled' }, { role: 'user', status: 'disabled' }]) reject(fixture(), 's', patch, 'superadmin', /最后.*超级管理员/); });
test('最后活跃 superadmin 仍可改昵称或提交不改变权限的字段', () => { assert.equal(updateAccount(fixture(), 's', { name: '新名字', role: 'superadmin', status: 'active' }, 'superadmin')[3].name, '新名字'); });
test('有其他活跃 superadmin 时允许降权或禁用', () => { const a = [...fixture(), account('s2', 'superadmin')]; for (const patch of [{ role: 'user' }, { status: 'disabled' }]) assert.deepEqual(updateAccount(a, 's', patch, 'superadmin')[3], { ...a[3], ...patch }); });
test('禁用 superadmin 可降权或重新启用', () => { for (const patch of [{ role: 'user' }, { status: 'active' }]) assert.deepEqual(updateAccount(fixture(), 'x', patch, 'superadmin')[4], { ...fixture()[4], ...patch }); });
test('拒绝空白和非字符串昵称', () => { for (const name of ['', '  \t\n', null, undefined]) reject(fixture(), 'u', { name }, 'superadmin', /昵称/); });
test('不存在的账号明确报错', () => { reject(fixture(), 'missing', { name: '修改' }, 'superadmin', /不存在/); });
test('拒绝非法角色和状态', () => { for (const patch of [{ role: 'owner' }, { status: 'unknown' }, { role: undefined }, { status: undefined }]) reject(fixture(), 'u', patch, 'superadmin', /角色|状态/); });
test('拒绝修改不可编辑字段', () => { for (const patch of [{ id: 'replacement' }, { createdAt: 'bad' }]) reject(fixture(), 'u', patch, 'superadmin', /字段/); });
test('统计所有角色和状态，admins 包含禁用的两类管理员', () => { assert.deepEqual(calculateMetrics(fixture()), { total: 5, active: 3, disabled: 2, admins: 3 }); });
test('空数组统计为零', () => { assert.deepEqual(calculateMetrics([]), { total: 0, active: 0, disabled: 0, admins: 0 }); });
