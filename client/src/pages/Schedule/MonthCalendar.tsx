import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';

import { Button } from '@/components/ui/button';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

interface MonthCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  month: Date;
  onMonthChange: (date: Date) => void;
  dots: Record<string, number>;
}

const MonthCalendar: React.FC<MonthCalendarProps> = ({
  selectedDate,
  onSelect,
  month,
  onMonthChange,
  dots,
}) => {
  const cells = useMemo(() => {
    const firstDay = dayjs(month).startOf('month');
    const startOfGrid = firstDay.startOf('week');
    const result: Array<{ date: dayjs.Dayjs; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const d = startOfGrid.add(i, 'day');
      result.push({
        date: d,
        inMonth: d.month() === firstDay.month(),
      });
    }
    return result;
  }, [month]);

  const selected = dayjs(selectedDate).format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  const currentMonthLabel = dayjs(month).format('YYYY 年 M 月');

  const handlePrevMonth = (): void => {
    onMonthChange(dayjs(month).subtract(1, 'month').toDate());
  };

  const handleNextMonth = (): void => {
    onMonthChange(dayjs(month).add(1, 'month').toDate());
  };

  const handleSelect = (d: dayjs.Dayjs): void => {
    onSelect(d.toDate());
    if (d.month() !== dayjs(month).month()) {
      onMonthChange(d.startOf('month').toDate());
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-8 w-8 text-[#636E72] hover:text-[#6C5CE7] hover:bg-[#F5F6FA]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold text-[#2D3436]">
          {currentMonthLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-8 w-8 text-[#636E72] hover:text-[#6C5CE7] hover:bg-[#F5F6FA]"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w: string) => (
          <div
            key={w}
            className="text-center text-xs font-medium text-[#B2BEC3] py-2"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const key = date.format('YYYY-MM-DD');
          const isSelected = key === selected;
          const isToday = key === today;
          const hasDots = dots[key] && dots[key] > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(date)}
              className={`
                relative aspect-square flex items-center justify-center
                text-sm rounded-full transition-colors
                ${
                  isSelected
                    ? 'bg-[#6C5CE7] text-white font-medium'
                    : inMonth
                    ? 'text-[#2D3436] hover:bg-[#F5F6FA]'
                    : 'text-[#B2BEC3] hover:bg-[#F5F6FA]'
                }
                ${
                  isToday && !isSelected
                    ? 'ring-2 ring-[#6C5CE7] ring-inset'
                    : ''
                }
              `}
            >
              {date.date()}
              {hasDots && (
                <span
                  className={`
                    absolute bottom-1.5 left-1/2 -translate-x-1/2
                    w-[5px] h-[5px] rounded-full
                    ${isSelected ? 'bg-white' : 'bg-[#6C5CE7]'}
                  `}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
