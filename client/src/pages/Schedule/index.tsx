import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Calendar as CalendarIcon } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type {
  Schedule,
  ScheduleStatus,
  ScheduleDayDot,
} from '@shared/api.interface';

import MonthCalendar from './MonthCalendar';
import ScheduleItem from './ScheduleItem';
import AddScheduleDialog from './AddScheduleDialog';

const SchedulePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(dayjs().toDate());
  const [currentMonth, setCurrentMonth] = useState<Date>(
    dayjs().startOf('month').toDate(),
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState<Record<string, number>>({});

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  const selectedDateStr = dayjs(selectedDate).format('YYYY-MM-DD');
  const selectedMonthStr = dayjs(currentMonth).format('YYYY-MM');

  const fetchSchedules = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await echofind.schedules.list({
        date: selectedDateStr,
      });
      setSchedules(res.items || []);
    } catch (err: unknown) {
      logger.error('获取日程列表失败', err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDateStr]);

  const fetchDots = useCallback(async (): Promise<void> => {
    try {
      const res = await echofind.schedules.dayDots({
        month: selectedMonthStr,
      });
      const dotMap: Record<string, number> = {};
      (res.dots || []).forEach((d: ScheduleDayDot) => {
        dotMap[d.date] = d.count;
      });
      setDots(dotMap);
    } catch (err: unknown) {
      logger.error('获取日程月标记失败', err);
      setDots({});
    }
  }, [selectedMonthStr]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    void fetchDots();
  }, [fetchDots]);

  const refreshAll = useCallback((): void => {
    void fetchSchedules();
    void fetchDots();
  }, [fetchSchedules, fetchDots]);

  const handleSelectDate = (date: Date): void => {
    setSelectedDate(date);
    setExpandedIds(new Set());
  };

  const handleMonthChange = (date: Date): void => {
    setCurrentMonth(date);
  };

  const handleToggle = (id: string): void => {
    setExpandedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleComplete = async (
    id: string,
    status: ScheduleStatus,
  ): Promise<void> => {
    try {
      await echofind.schedules.update(id, { status });
      setSchedules((prev: Schedule[]) =>
        prev.map((s: Schedule) =>
          s.id === id ? { ...s, status } : s,
        ),
      );
    } catch (err: unknown) {
      logger.error('更新日程状态失败', err);
      toast.error('操作失败，请重试');
    }
  };

  const handleEdit = (schedule: Schedule): void => {
    setEditSchedule(schedule);
    setAddDialogOpen(true);
  };

  const handleDeleteClick = (id: string): void => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await echofind.schedules.remove(deleteTargetId);
      setSchedules((prev: Schedule[]) =>
        prev.filter((s: Schedule) => s.id !== deleteTargetId),
      );
      setDeleteDialogOpen(false);
      setDeleteTargetId('');
      toast.success('日程已删除');
      void fetchDots();
    } catch (err: unknown) {
      logger.error('删除日程失败', err);
      toast.error('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCreate = (): void => {
    setEditSchedule(null);
    setAddDialogOpen(true);
  };

  const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekdayLabel = `${dayjs(selectedDate).format('M 月 D 日')} ${WEEKDAY_NAMES[dayjs(selectedDate).day()]}`;

  const sortedSchedules = [...schedules].sort(
    (a: Schedule, b: Schedule) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
  );

  return (
    <div className="p-6 min-w-[1024px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436] flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-[#6C5CE7]" />
            日程清单
          </h1>
          <p className="text-sm text-[#636E72] mt-1">
            管理每日日程安排，小寻提醒必带物品
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-[#6C5CE7] hover:bg-[#5B4CDB]"
        >
          <CalendarPlus className="h-4 w-4 mr-1.5" />
          新增日程
        </Button>
      </div>

      <div className="flex gap-5">
        <div className="w-[40%] shrink-0">
          <MonthCalendar
            selectedDate={selectedDate}
            onSelect={handleSelectDate}
            month={currentMonth}
            onMonthChange={handleMonthChange}
            dots={dots}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h2 className="text-lg font-semibold text-[#2D3436] mb-4">
              {weekdayLabel}
              <span className="ml-2 text-sm font-normal text-[#636E72]">
                共 {schedules.length} 项日程
              </span>
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i: number) => (
                  <div
                    key={i}
                    className="h-12 bg-[#F5F6FA] rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : sortedSchedules.length > 0 ? (
              <div className="space-y-3">
                {sortedSchedules.map((schedule: Schedule) => (
                  <ScheduleItem
                    key={schedule.id}
                    schedule={schedule}
                    expanded={expandedIds.has(schedule.id)}
                    onToggle={() => handleToggle(schedule.id)}
                    onComplete={handleComplete}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CalendarIcon className="h-12 w-12 text-[#DFE6E9] mx-auto mb-3" />
                <p className="text-sm text-[#B2BEC3]">
                  当天暂无日程，点击右上角新增～
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddScheduleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        editSchedule={editSchedule}
        defaultDate={selectedDateStr}
        onSaved={refreshAll}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定要删除这条日程吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleting}
              className="bg-[#E17055] hover:bg-[#d65d40]"
            >
              {deleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
