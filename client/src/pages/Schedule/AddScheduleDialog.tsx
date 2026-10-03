import { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type {
  Schedule,
  ScheduleCreateRequest,
  ScheduleTag,
  ScheduleStatus,
} from '@shared/api.interface';

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule: Schedule | null;
  defaultDate: string;
  onSaved: () => void;
}

const TAG_OPTIONS: Array<{ value: ScheduleTag; label: string }> = [
  { value: 'work', label: '工作' },
  { value: 'travel', label: '出行' },
  { value: 'life', label: '生活' },
  { value: 'other', label: '其他' },
];

const STATUS_OPTIONS: Array<{ value: ScheduleStatus; label: string }> = [
  { value: 'pending', label: '待完成' },
  { value: 'completed', label: '已完成' },
];

interface FormState {
  title: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  location: string;
  tag: ScheduleTag;
  status: ScheduleStatus;
  description: string;
}

const defaultForm = (dateStr: string): FormState => ({
  title: '',
  scheduleDate: dateStr,
  startTime: '09:00',
  endTime: '10:00',
  location: '',
  tag: 'work',
  status: 'pending',
  description: '',
});

const AddScheduleDialog: React.FC<AddScheduleDialogProps> = ({
  open,
  onOpenChange,
  editSchedule,
  defaultDate,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(defaultForm(defaultDate));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (editSchedule) {
        setForm({
          title: editSchedule.title,
          scheduleDate: editSchedule.scheduleDate,
          startTime: editSchedule.startTime || '09:00',
          endTime: editSchedule.endTime || '10:00',
          location: editSchedule.location || '',
          tag: editSchedule.tag,
          status: editSchedule.status,
          description: editSchedule.description || '',
        });
      } else {
        setForm(defaultForm(defaultDate));
      }
      setFormError('');
    }
  }, [open, editSchedule, defaultDate]);

  const handleChange = (
    field: keyof FormState,
    value: string | ScheduleTag | ScheduleStatus,
  ): void => {
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    if (!form.title.trim()) {
      setFormError('请输入日程标题');
      return false;
    }
    if (!form.scheduleDate) {
      setFormError('请选择日期');
      return false;
    }
    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      setFormError('结束时间需晚于开始时间');
      return false;
    }
    return true;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: ScheduleCreateRequest = {
        title: form.title.trim(),
        scheduleDate: form.scheduleDate,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        location: form.location.trim() || undefined,
        tag: form.tag,
        status: form.status,
        description: form.description.trim() || undefined,
      };

      if (editSchedule) {
        await echofind.schedules.update(editSchedule.id, payload);
        toast.success('日程已更新');
      } else {
        await echofind.schedules.create(payload);
        toast.success('日程已创建');
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      logger.error('保存日程失败', err);
      setFormError('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDateObj = form.scheduleDate
    ? dayjs(form.scheduleDate).toDate()
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editSchedule ? '编辑日程' : '新增日程'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('title', e.target.value)
              }
              placeholder="请输入日程标题"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>日期</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.scheduleDate
                      ? dayjs(form.scheduleDate).format('YYYY-MM-DD')
                      : '选择日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDateObj}
                    onSelect={(d: Date | undefined) => {
                      if (d) {
                        handleChange(
                          'scheduleDate',
                          dayjs(d).format('YYYY-MM-DD'),
                        );
                      }
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">开始</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('startTime', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">结束</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('endTime', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">地点</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('location', e.target.value)
              }
              placeholder="选填"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>标签</Label>
              <Select
                value={form.tag}
                onValueChange={(v: string) =>
                  handleChange('tag', v as ScheduleTag)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_OPTIONS.map(
                    (opt: { value: ScheduleTag; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(v: string) =>
                  handleChange('status', v as ScheduleStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(
                    (opt: { value: ScheduleStatus; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleChange('description', e.target.value)
              }
              placeholder="选填，补充日程详情"
              rows={3}
            />
          </div>

          {formError && (
            <p className="text-sm text-[#E17055]">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="bg-[#6C5CE7] hover:bg-[#5B4CDB]"
          >
            {submitting ? '保存中...' : '确定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddScheduleDialog;
