import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Image from '@/components/ui/image';
import ItemIcon from '@/components/ui/item-icon';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import { usePoll } from '@client/src/hooks/use-poll';
import type { Item, ItemDisposition } from '@shared/api.interface';

dayjs.extend(relativeTime);

const PAGE_SIZE = 10;

interface FormData {
  id: string;
  name: string;
  signalStrength: string;
  isStored: boolean;
  imageUrl: string;
  deviceId: string;
  disposition: ItemDisposition;
  location: string;
}

const initialFormData: FormData = {
  id: '',
  name: '',
  signalStrength: '',
  isStored: false,
  imageUrl: '',
  deviceId: '',
  disposition: 'keep',
  location: '',
};

const Items: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [isStoredFilter, setIsStoredFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initialLoadRef = useRef(false);

  const debouncedSearch = useMemo(() => search, [search]);

  const fetchItems = async (): Promise<void> => {
    setLoading(true);
    try {
      const isStored =
        isStoredFilter === 'all'
          ? undefined
          : isStoredFilter === 'stored'
          ? true
          : false;
      const response = await echofind.items.list({
        search: debouncedSearch || undefined,
        isStored,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err: unknown) {
      logger.error('获取物品列表失败', err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initialLoadRef.current = true;
    void fetchItems();
    return (): void => {
      initialLoadRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isStoredFilter, page]);

  usePoll(
    async (): Promise<void> => {
      if (!initialLoadRef.current) return;
      await fetchItems();
    },
    [debouncedSearch, isStoredFilter, page],
    { intervalMs: 8000 },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    if (val.trim()) {
      setSearchParams({ search: val.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== search) {
      setSearch(q);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleFilterChange = (value: string): void => {
    setIsStoredFilter(value);
    setPage(1);
  };

  const openCreateDialog = (): void => {
    setFormData(initialFormData);
    setFormError('');
    setCreateDialogOpen(true);
  };

  const openEditDialog = (item: Item): void => {
    setCurrentItem(item);
      setFormData({
      id: item.id,
      name: item.name,
      signalStrength: item.signalStrength?.toString() ?? '',
      isStored: item.isStored ?? false,
      imageUrl: item.imageUrl ?? '',
      deviceId: item.deviceId ?? '',
      disposition: item.disposition ?? 'keep',
      location: item.location ?? '',
    });
    setFormError('');
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (item: Item): void => {
    setCurrentItem(item);
    setDeleteDialogOpen(true);
  };

  const validateForm = (): boolean => {
    if (!formData.id.trim()) {
      setFormError('请输入物品编号');
      return false;
    }
    if (!formData.name.trim()) {
      setFormError('请输入物品名称');
      return false;
    }
    if (formData.signalStrength !== '') {
      const num = Number(formData.signalStrength);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        setFormError('信号强度必须是 0-100 之间的数字');
        return false;
      }
    }
    return true;
  };

  const handleCreate = async (): Promise<void> => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await echofind.items.create({
        id: formData.id.trim(),
        name: formData.name.trim(),
        signalStrength:
          formData.signalStrength !== ''
            ? Number(formData.signalStrength)
            : undefined,
        isStored: formData.isStored,
        imageUrl: formData.imageUrl.trim() || undefined,
        deviceId: formData.deviceId.trim() || undefined,
        disposition: formData.disposition,
        location: formData.location.trim() || undefined,
      });
      setCreateDialogOpen(false);
      void fetchItems();
    } catch (err: unknown) {
      logger.error('创建物品失败', err);
      setFormError('创建失败，请检查编号是否已存在');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (): Promise<void> => {
    if (!currentItem) return;
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await echofind.items.update(currentItem.id, {
        name: formData.name.trim(),
        signalStrength:
          formData.signalStrength !== ''
            ? Number(formData.signalStrength)
            : undefined,
        isStored: formData.isStored,
        imageUrl: formData.imageUrl.trim() || undefined,
        deviceId: formData.deviceId.trim() || undefined,
        disposition: formData.disposition,
        location: formData.location.trim() || undefined,
      });
      setEditDialogOpen(false);
      void fetchItems();
    } catch (err: unknown) {
      logger.error('更新物品失败', err);
      setFormError('更新失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeDisposition = async (item: Item, disposition: ItemDisposition): Promise<void> => {
    try {
      await echofind.items.update(item.id, { disposition });
      void fetchItems();
    } catch (err: unknown) {
      logger.error('更新去向失败', err);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!currentItem) return;
    setDeleting(true);
    try {
      await echofind.items.remove(currentItem.id);
      setDeleteDialogOpen(false);
      // 如果删除后当前页无数据，回退到上一页
      if (items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        void fetchItems();
      }
    } catch (err: unknown) {
      logger.error('删除物品失败', err);
    } finally {
      setDeleting(false);
    }
  };

  const renderSignalBar = (strength: number): React.ReactNode => {
    const color =
      strength >= 70
        ? 'bg-[#00B894]'
        : strength >= 40
        ? 'bg-[#FDCB6E]'
        : 'bg-[#E17055]';
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-[#DFE6E9] rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, strength))}%` }}
          />
        </div>
        <span className="text-sm text-[#636E72] tabular-nums min-w-[36px]">
          {strength.toFixed(0)}%
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* 顶部工具栏 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436] flex items-center gap-2">
            <Package className="h-6 w-6 text-[#6C5CE7]" />
            物品管理
          </h1>
          <p className="text-sm text-[#636E72] mt-1">
            管理所有物品及其贴纸绑定
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B2BEC3]" />
            <Input
              type="search"
              placeholder="搜索物品名称或编号..."
              value={search}
              onChange={handleSearchChange}
              className="w-64 pl-9"
            />
          </div>
          <Select value={isStoredFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="是否存入" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="stored">已存入</SelectItem>
              <SelectItem value="not-stored">未存入</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={openCreateDialog}
            className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white border-[#6C5CE7]"
          >
            <Plus className="h-4 w-4" />
            新增物品
          </Button>
        </div>
      </div>

      {/* 物品列表卡片 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-[#B2BEC3]">数据加载中...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F5F6FA] mb-4">
              <PackageOpen className="h-8 w-8 text-[#B2BEC3]" />
            </div>
            <p className="text-sm text-[#636E72]">暂无物品数据</p>
            <p className="text-xs text-[#B2BEC3] mt-1">
              点击右上角「新增物品」添加第一个物品
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F6FA]">
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                    物品信息
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                    信号强度
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                    上报时间
                  </th>
                   <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                      状态
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                      位置
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                      去向
                    </th>
                   <th className="text-left px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                     绑定贴纸
                   </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-[#636E72] uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE6E9]">
                {items.map((item: Item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F5F6FA] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         {item.imageUrl ? (
                           <Image
                             src={item.imageUrl}
                             alt={item.name}
                             width={40}
                             height={40}
                             className="w-10 h-10 rounded-lg object-cover bg-[#F5F6FA]"
                           />
                         ) : (
                           <ItemIcon name={item.name} className="w-10 h-10" size={40} />
                         )}
                        <div>
                          <div className="text-sm font-medium text-[#2D3436]">
                            {item.name}
                          </div>
                          <div className="text-xs text-[#B2BEC3]">
                            {item.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {renderSignalBar(item.signalStrength ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#2D3436]">
                        {item.reportTime
                          ? dayjs(item.reportTime).fromNow()
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.isStored ? (
                        <Badge
                          className="bg-[#00B894]/10 text-[#00B894] border-transparent shadow-none"
                          variant="outline"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00B894] mr-1.5" />
                          已存入
                        </Badge>
                      ) : (
                        <Badge
                          className="bg-[#DFE6E9]/50 text-[#636E72] border-transparent shadow-none"
                          variant="outline"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B2BEC3] mr-1.5" />
                          未存入
                        </Badge>
                      )}
                    </td>
                     <td className="px-6 py-4">
                       <span className="text-sm text-[#2D3436]">
                         {item.location || '-'}
                       </span>
                     </td>
                    <td className="px-6 py-4">
                       <Select
                         value={item.disposition ?? 'keep'}
                         onValueChange={(val: string): void => {
                           void handleChangeDisposition(item, val as ItemDisposition);
                         }}
                       >
                         <SelectTrigger className="h-8 w-24 text-xs border-transparent bg-transparent hover:bg-[#F5F6FA] focus:ring-0 focus:ring-offset-0 shadow-none px-2">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent className="w-28">
                           <SelectItem value="keep" className="text-xs">
                             <span className="flex items-center gap-1.5">
                               <span className="w-2 h-2 rounded-full bg-[#00B894]" />
                               保留
                             </span>
                           </SelectItem>
                           <SelectItem value="discard" className="text-xs">
                             <span className="flex items-center gap-1.5">
                               <span className="w-2 h-2 rounded-full bg-[#636E72]" />
                               丢弃
                             </span>
                           </SelectItem>
                           <SelectItem value="recycle" className="text-xs">
                             <span className="flex items-center gap-1.5">
                               <span className="w-2 h-2 rounded-full bg-[#74B9FF]" />
                               回收
                             </span>
                           </SelectItem>
                         </SelectContent>
                       </Select>
                     </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-[#636E72]">
                        {item.deviceId || '-'}
                      </span>
                    </td>
                     <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => item.isStored && openEditDialog(item)}
                           disabled={!item.isStored}
                           title={item.isStored ? '' : '存入后才能命名'}
                           className={`h-8 ${item.isStored
                             ? 'text-[#636E72] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/10'
                             : 'text-[#B2BEC3] cursor-not-allowed opacity-60 hover:bg-transparent'
                           }`}
                         >
                           <Edit2 className="h-4 w-4" />
                           编辑
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => openDeleteDialog(item)}
                           className="text-[#E17055] hover:bg-[#E17055]/10 hover:text-[#E17055] h-8"
                         >
                           <Trash2 className="h-4 w-4" />
                           删除
                         </Button>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分页 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#DFE6E9]">
              <div className="text-sm text-[#636E72]">
                共 {total} 条记录，第 {page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 新增物品弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#2D3436]">
              新增物品
            </DialogTitle>
            <DialogDescription>
              填写物品基本信息并绑定贴纸设备
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-id">
                编号 <span className="text-[#E17055]">*</span>
              </Label>
              <Input
                id="create-id"
                value={formData.id}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, id: e.target.value })
                }
                placeholder="请输入物品编号"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">
                物品名称 <span className="text-[#E17055]">*</span>
              </Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="请输入物品名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-signal">信号强度（0-100）</Label>
              <Input
                id="create-signal"
                type="number"
                min={0}
                max={100}
                value={formData.signalStrength}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, signalStrength: e.target.value })
                }
                placeholder="可选，例如 85"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="create-stored">是否存入</Label>
              <Switch
                id="create-stored"
                checked={formData.isStored}
                onCheckedChange={(checked: boolean): void =>
                  setFormData({ ...formData, isStored: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-image">物品图片 URL</Label>
              <Input
                id="create-image"
                value={formData.imageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="可选，图片链接地址"
              />
            </div>
             <div className="space-y-2">
               <Label htmlFor="create-device">绑定贴纸编号</Label>
               <Input
                 id="create-device"
                 value={formData.deviceId}
                 onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                   setFormData({ ...formData, deviceId: e.target.value })
                 }
                 placeholder="可选，贴纸设备编号"
               />
             </div>
              <div className="space-y-2">
                <Label htmlFor="create-location">位置</Label>
                <Select
                  value={formData.location}
                  onValueChange={(val: string): void =>
                    setFormData({ ...formData, location: val })
                  }
                >
                  <SelectTrigger id="create-location">
                    <SelectValue placeholder="请选择位置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="客厅">客厅</SelectItem>
                    <SelectItem value="卧室">卧室</SelectItem>
                    <SelectItem value="储物柜">储物柜</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-disposition">去向</Label>
               <Select
                 value={formData.disposition}
                 onValueChange={(val: string): void =>
                   setFormData({ ...formData, disposition: val as ItemDisposition })
                 }
               >
                 <SelectTrigger id="create-disposition">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="keep">保留</SelectItem>
                   <SelectItem value="discard">丢弃</SelectItem>
                   <SelectItem value="recycle">回收</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             {formError && (
              <div className="text-sm text-[#E17055] bg-[#E17055]/10 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={(): void => setCreateDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={(): Promise<void> => handleCreate()}
              disabled={submitting}
              className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white border-[#6C5CE7]"
            >
              {submitting ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑物品弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#2D3436]">
              编辑物品
            </DialogTitle>
            <DialogDescription>修改物品信息和贴纸绑定</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-id">编号</Label>
              <Input
                id="edit-id"
                value={formData.id}
                disabled
                className="bg-[#F5F6FA] text-[#B2BEC3] cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                物品名称 <span className="text-[#E17055]">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="请输入物品名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-signal">信号强度（0-100）</Label>
              <Input
                id="edit-signal"
                type="number"
                min={0}
                max={100}
                value={formData.signalStrength}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, signalStrength: e.target.value })
                }
                placeholder="可选，例如 85"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-stored">是否存入</Label>
              <Switch
                id="edit-stored"
                checked={formData.isStored}
                onCheckedChange={(checked: boolean): void =>
                  setFormData({ ...formData, isStored: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-image">物品图片 URL</Label>
              <Input
                id="edit-image"
                value={formData.imageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="可选，图片链接地址"
              />
            </div>
             <div className="space-y-2">
               <Label htmlFor="edit-device">绑定贴纸编号</Label>
               <Input
                 id="edit-device"
                 value={formData.deviceId}
                 onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                   setFormData({ ...formData, deviceId: e.target.value })
                 }
                 placeholder="可选，贴纸设备编号"
               />
             </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">位置</Label>
                <Select
                  value={formData.location}
                  onValueChange={(val: string): void =>
                    setFormData({ ...formData, location: val })
                  }
                >
                  <SelectTrigger id="edit-location">
                    <SelectValue placeholder="请选择位置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="客厅">客厅</SelectItem>
                    <SelectItem value="卧室">卧室</SelectItem>
                    <SelectItem value="储物柜">储物柜</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-disposition">去向</Label>
               <Select
                 value={formData.disposition}
                 onValueChange={(val: string): void =>
                   setFormData({ ...formData, disposition: val as ItemDisposition })
                 }
               >
                 <SelectTrigger id="edit-disposition">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="keep">保留</SelectItem>
                   <SelectItem value="discard">丢弃</SelectItem>
                   <SelectItem value="recycle">回收</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             {formError && (
              <div className="text-sm text-[#E17055] bg-[#E17055]/10 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={(): void => setEditDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={(): Promise<void> => handleUpdate()}
              disabled={submitting}
              className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white border-[#6C5CE7]"
            >
              {submitting ? '保存中...' : '确认保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#2D3436]">
              删除物品
            </DialogTitle>
            <DialogDescription>
              确定要删除该物品吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {currentItem && (
            <div className="py-2">
              <div className="bg-[#F5F6FA] rounded-lg p-3 flex items-center gap-3">
                 {currentItem.imageUrl ? (
                   <Image
                     src={currentItem.imageUrl}
                     alt={currentItem.name}
                     width={40}
                     height={40}
                     className="w-10 h-10 rounded-lg object-cover"
                   />
                 ) : (
                   <ItemIcon name={currentItem.name} className="w-10 h-10" size={40} />
                 )}
                <div>
                  <div className="text-sm font-medium text-[#2D3436]">
                    {currentItem.name}
                  </div>
                  <div className="text-xs text-[#B2BEC3]">
                    {currentItem.id}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={(): void => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              onClick={(): Promise<void> => handleDelete()}
              disabled={deleting}
              className="bg-[#E17055] hover:bg-[#d65c42] text-white border-[#E17055]"
              variant="destructive"
            >
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Items;
