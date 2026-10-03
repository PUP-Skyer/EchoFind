import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Pencil,
  Trash2,
  MapPin,
  Sparkles,
  Package,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type {
  Schedule,
  ScheduleStatus,
  ScheduleRecommendItem,
} from '@shared/api.interface';

interface ScheduleItemProps {
  schedule: Schedule;
  expanded: boolean;
  onToggle: () => void;
  onComplete: (id: string, status: ScheduleStatus) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
}

const TAG_COLORS: Record<string, string> = {
  work: '#6C5CE7',
  travel: '#00B894',
  life: '#FDCB6E',
  other: '#B2BEC3',
};

const TAG_LABELS: Record<string, string> = {
  work: '工作',
  travel: '出行',
  life: '生活',
  other: '其他',
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: '待完成',
  completed: '已完成',
  cancelled: '已取消',
};

const ScheduleItem: React.FC<ScheduleItemProps> = ({
  schedule,
  expanded,
  onToggle,
  onComplete,
  onEdit,
  onDelete,
}) => {
  const [recommend, setRecommend] = useState<ScheduleRecommendItem[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendFetched, setRecommendFetched] = useState(false);

  useEffect(() => {
    if (expanded && !recommendFetched) {
      setRecommendFetched(true);
      const fetchRecommend = async (): Promise<void> => {
        setRecommendLoading(true);
        try {
          const res = await echofind.schedules.recommend({
            date: schedule.scheduleDate,
          });
          setRecommend(res.items || []);
        } catch (err: unknown) {
          logger.error('获取小寻建议失败', err);
          setRecommend([]);
        } finally {
          setRecommendLoading(false);
        }
      };
      void fetchRecommend();
    }
  }, [expanded, recommendFetched, schedule.scheduleDate]);

  const tagColor = TAG_COLORS[schedule.tag] || TAG_COLORS.other;
  const tagLabel = TAG_LABELS[schedule.tag] || '其他';
  const isCompleted = schedule.status === 'completed';

  const handleComplete = (): void => {
    const nextStatus: ScheduleStatus = isCompleted ? 'pending' : 'completed';
    onComplete(schedule.id, nextStatus);
    toast.success(isCompleted ? '已取消完成状态' : '已标记为完成');
  };

  const handleEdit = (): void => {
    onEdit(schedule);
  };

  const handleDelete = (): void => {
    onDelete(schedule.id);
  };

  const dateLabel = dayjs(schedule.scheduleDate).format('YYYY-MM-DD');

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)]
        overflow-hidden transition-all
        ${expanded ? 'ring-1 ring-[#6C5CE7]/20' : ''}
      `}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F6FA]/50 transition-colors text-left"
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: tagColor }}
        />
        <span
          className={`text-sm tabular-nums min-w-[100px] ${
            isCompleted ? 'line-through text-[#B2BEC3]' : 'text-[#636E72]'
          }`}
        >
          {schedule.startTime} - {schedule.endTime}
        </span>
        <span
          className={`flex-1 truncate text-sm font-medium ${
            isCompleted ? 'line-through text-[#B2BEC3]' : 'text-[#2D3436]'
          }`}
        >
          {schedule.title}
        </span>
        {schedule.location && (
          <span className="text-xs text-[#B2BEC3] flex items-center gap-1 shrink-0 max-w-[120px] truncate">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{schedule.location}</span>
          </span>
        )}
        <span className="text-xs text-[#B2BEC3] shrink-0">{tagLabel}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#B2BEC3] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#B2BEC3] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#F5F6FA] space-y-3">
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <p className="text-xs text-[#B2BEC3] mb-1">时间</p>
              <p className="text-sm text-[#2D3436]">
                {dateLabel} {schedule.startTime} - {schedule.endTime}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#B2BEC3] mb-1">地点</p>
              <p className="text-sm text-[#2D3436]">
                {schedule.location || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#B2BEC3] mb-1">标签</p>
              <Badge
                variant="outline"
                className="border-transparent text-white"
                style={{ backgroundColor: tagColor }}
              >
                {tagLabel}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-[#B2BEC3] mb-1">状态</p>
              <Badge
                variant={isCompleted ? 'default' : 'secondary'}
                className={
                  isCompleted ? 'bg-[#00B894]' : 'bg-[#F5F6FA] text-[#636E72]'
                }
              >
                {STATUS_LABELS[schedule.status]}
              </Badge>
            </div>
          </div>

          {schedule.description && (
            <div>
              <p className="text-xs text-[#B2BEC3] mb-1">描述</p>
              <p className="text-sm text-[#2D3436] whitespace-pre-wrap">
                {schedule.description}
              </p>
            </div>
          )}

          <div className="bg-[#F5F6FA] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-[#6C5CE7]" />
              <span className="text-sm font-medium text-[#2D3436]">
                小寻建议 · 必带物品
              </span>
            </div>
            {recommendLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i: number) => (
                  <div
                    key={i}
                    className="h-8 bg-white rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : recommend.length > 0 ? (
              <div className="space-y-1.5">
                {recommend.map((item: ScheduleRecommendItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 bg-white rounded-lg px-3 py-2"
                  >
                    <Package className="h-4 w-4 text-[#6C5CE7] shrink-0" />
                    <span className="text-sm text-[#2D3436] flex-1 truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-[#B2BEC3] shrink-0">
                      {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#B2BEC3]">暂无推荐物品</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleComplete}
              className="text-[#00B894] hover:text-[#00B894] hover:bg-[#00B894]/10"
            >
              <Check className="h-4 w-4 mr-1" />
              {isCompleted ? '取消完成' : '完成'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="text-[#6C5CE7] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
            >
              <Pencil className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-[#E17055] hover:text-[#E17055] hover:bg-[#E17055]/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleItem;
