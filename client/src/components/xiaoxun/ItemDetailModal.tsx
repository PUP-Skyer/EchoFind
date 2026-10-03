import React from 'react';
import { createPortal } from 'react-dom';
import { X, Bot, Wifi, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Image from '@client/src/components/ui/image';
import ItemIcon from '@client/src/components/ui/item-icon';
import type { Item } from '@shared/api.interface';

interface ItemDetailModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkBrought: (itemId: string) => void;
  isMarked: boolean;
  onFind?: (item: Item) => void;
}

const signalColor = (strength: number): string => {
  if (strength >= 70) return 'bg-[#00B894]';
  if (strength >= 40) return 'bg-[#FDCB6E]';
  return 'bg-[#E17055]';
};

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onMarkBrought,
  isMarked,
  onFind,
}) => {
  const navigate = useNavigate();

  if (!item) return null;
  if (typeof document === 'undefined') return null;

  const handleGoToItems = (): void => {
    onClose();
    navigate('/items');
  };

  const formatTime = (iso: string): string => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const modalContent = (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 z-[9998]' : 'opacity-0 pointer-events-none -z-10'
        }`}
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Modal */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[calc(100vw-32px)] bg-white rounded-[20px] shadow-2xl overflow-hidden transition-all duration-200 ${
          isOpen ? 'scale-100 opacity-100 z-[9999]' : 'scale-95 opacity-0 pointer-events-none -z-10'
        }`}
        style={{ position: 'fixed' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Item Image */}
        <div className="relative h-44 bg-[#F5F6FA]">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ItemIcon name={item.name} className="w-full h-full" size={80} />
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Name + device id */}
          <div>
            <h3 className="text-xl font-bold text-[#2D3436]">{item.name}</h3>
            <div className="text-sm font-mono text-[#B2BEC3] mt-0.5">
              {item.deviceId}
            </div>
          </div>

          {/* Signal Strength */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-[#636E72]">
                <Wifi size={12} />
                <span>信号强度</span>
              </div>
              <span className="text-sm font-semibold text-[#2D3436]">
                {item.signalStrength.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-[#F5F6FA] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${signalColor(item.signalStrength)}`}
                style={{ width: `${item.signalStrength}%` }}
              />
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                item.signalStrength > 0 ? 'bg-[#00B894]' : 'bg-[#B2BEC3]'
              }`} />
              <span className="text-sm text-[#2D3436]">
                {item.signalStrength > 0 ? '在线' : '离线'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {item.isStored ? (
                <CheckCircle size={14} className="text-[#00B894]" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-sm border-2 border-[#B2BEC3]" />
              )}
              <span className="text-sm text-[#2D3436]">
                {item.isStored ? '已存入阻隔盒' : '未存入阻隔盒'}
              </span>
            </div>
          </div>

          {/* Last Report */}
          <div className="flex items-center gap-2 text-xs text-[#636E72]">
            <Clock size={12} />
            <span>最近上报：{formatTime(item.reportTime)}</span>
          </div>

          {/* Xiaoxun Suggestion */}
          <div className="flex gap-3 p-3 rounded-xl bg-[#6C5CE708] border border-[#6C5CE720]">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="text-sm text-[#636E72] leading-relaxed">
              {item.isStored
                ? '该物品已存入阻隔盒，出门前记得带上哦～ 点击下方"标记已带"来记录。'
                : '小寻发现这个物品还没存入阻隔盒，建议尽快归位，避免出门找不到。'}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleGoToItems}
              className="flex-1 h-11 rounded-xl bg-[#F5F6FA] text-[#636E72] font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#6C5CE710] hover:text-[#6C5CE7] transition-colors"
            >
              前往管理
              <ArrowRight size={14} />
            </button>
            {onFind && (
              <button
                onClick={(): void => onFind(item)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white font-medium text-sm flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <Wifi size={14} />
                找它
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

export default ItemDetailModal;
