export type Role = 'user' | 'admin' | 'superadmin';

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
  createdAt: string;
  lastActive: string | null;
  channel: string;
}

export interface Feedback {
  id: string;
  userName: string;
  subject: string;
  message: string;
  status: 'pending' | 'processing' | 'resolved';
  source: 'APP' | '网页';
  reply: string;
}

export const roleLabels: Record<Role, string> = { user: '普通用户', admin: '管理员', superadmin: '超级管理员' };
export const statusLabels: Record<Account['status'], string> = { active: '正常', disabled: '已禁用' };

// 固定的虚构演示数据；example.com 为示例域名，不访问任何外部服务。
export const demoAccounts: Account[] = Array.from({ length: 24 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `demo-${number}`, name: `虚构用户${number}`, email: `demo${number}@example.com`,
    role: index === 0 ? 'superadmin' : index < 4 ? 'admin' : 'user',
    status: index > 0 && index % 5 === 0 ? 'disabled' : 'active',
    createdAt: `2026-01-${number}T08:00:00.000Z`,
    lastActive: index % 6 === 0 ? null : `2026-02-${number}T09:00:00.000Z`,
    channel: index % 2 === 0 ? 'APP' : '网页',
  };
});

export const demoFeedback: Feedback[] = [
  { id: 'feedback-01', userName: '虚构用户05', subject: '定位刷新建议', message: '希望能手动刷新物品位置。', status: 'pending', source: 'APP', reply: '' },
  { id: 'feedback-02', userName: '虚构用户09', subject: '设备绑定提示', message: '设备绑定后提示出现较慢。', status: 'processing', source: '网页', reply: '已收到，正在排查提示延迟。' },
  { id: 'feedback-03', userName: '虚构用户12', subject: '通知设置咨询', message: '如何关闭设备离线通知？', status: 'resolved', source: 'APP', reply: '可在设置中的通知选项关闭设备离线提醒。' },
];

/** 搜索 ID、昵称、邮箱；三个筛选条件取交集，all 表示不限。 */
export function filterAccounts(accounts: readonly Account[], search: string, role: Role | 'all', status: Account['status'] | 'all'): Account[] {
  const query = search.trim().toLowerCase();
  return accounts.filter(account =>
    (role === 'all' || account.role === role) &&
    (status === 'all' || account.status === status) &&
    [account.id, account.name, account.email].some(value => value.toLowerCase().includes(query)),
  );
}

/** 返回新数组；校验失败抛出 Error，始终不修改输入。仅允许编辑昵称、邮箱、角色、状态。 */
export function updateAccount(accounts: readonly Account[], id: string, patch: Partial<Pick<Account, 'name' | 'email' | 'role' | 'status'>>, actorRole: Role): Account[] {
  if (actorRole !== 'admin' && actorRole !== 'superadmin') throw new Error('没有管理权限');
  const target = accounts.find(account => account.id === id);
  if (!target) throw new Error('账号不存在');
  const has = (key: string) => Object.prototype.hasOwnProperty.call(patch, key);
  if (actorRole === 'admin') {
    if (target.role !== 'user') throw new Error('管理员不能管理其他管理员');
    if (has('role')) throw new Error('管理员不能修改角色');
  }
  for (const key of Object.keys(patch)) {
    if (!['name', 'email', 'role', 'status'].includes(key)) throw new Error(`不允许修改字段：${key}`);
  }
  if (has('name') && (typeof patch.name !== 'string' || !patch.name.trim())) throw new Error('昵称不能为空');
  if (has('role') && !['user', 'admin', 'superadmin'].includes(patch.role as string)) throw new Error('无效角色');
  if (has('status') && !['active', 'disabled'].includes(patch.status as string)) throw new Error('无效状态');
  const updated = { ...target, ...patch, name: has('name') ? patch.name!.trim() : target.name };
  if (target.role === 'superadmin' && target.status === 'active' &&
      (updated.role !== 'superadmin' || updated.status !== 'active') &&
      !accounts.some(account => account.id !== id && account.role === 'superadmin' && account.status === 'active')) {
    throw new Error('不能降权或禁用最后一个活跃超级管理员');
  }
  return accounts.map(account => account.id === id ? updated : account);
}

/** admins 统计 admin 和 superadmin，包含禁用账号。 */
export function calculateMetrics(accounts: readonly Account[]): { total: number; active: number; disabled: number; admins: number } {
  return accounts.reduce((metrics, account) => {
    metrics.total += 1;
    if (account.status === 'active') metrics.active += 1;
    if (account.status === 'disabled') metrics.disabled += 1;
    if (account.role === 'admin' || account.role === 'superadmin') metrics.admins += 1;
    return metrics;
  }, { total: 0, active: 0, disabled: 0, admins: 0 });
}
