import React, { useEffect, useRef, useState } from 'react';
import { User, Heart, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserMenuPopoverProps {
  userName: string;
  userRole?: string;
}

interface MenuItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  path: string;
  color?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'profile', label: '用户信息', icon: User, path: '/profile', color: '#6C5CE7' },
  { key: 'pet', label: '桌宠乐园', icon: Heart, path: '/pet-paradise', color: '#E17055' },
  { key: 'settings', label: '设置', icon: Settings, path: '/settings', color: '#6C5CE7' },
];

const UserMenuPopover: React.FC<UserMenuPopoverProps> = ({ userName, userRole }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [alignTop, setAlignTop] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (trigger && popover) {
      const triggerRect = trigger.getBoundingClientRect();
      const popoverHeight = popover.offsetHeight;
      const spaceBelow = window.innerHeight - triggerRect.top;
      setAlignTop(spaceBelow >= popoverHeight + 8);
    }

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleItemClick = (path: string): void => {
    setIsOpen(false);
    navigate(path);
  };

  const handleLogout = (): void => {
    setIsOpen(false);
    navigate('/api/v1/account/logout');
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-5 px-6 py-5 rounded-xl hover:bg-[#F5F6FA] transition-colors cursor-pointer group text-left"
      >
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white text-lg font-medium shadow-sm flex-shrink-0">
          {userName.slice(0, 1) || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-medium text-[#2D3436] truncate">
            {userName}
          </div>
          <div className="text-base text-[#B2BEC3] truncate">{userRole || '个人中心'}</div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-[#B2BEC3] transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute left-full ml-2 w-52 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0_0_0_0.1)] border border-[#F5F6FA] py-2 z-50 animate-in fade-in zoom-in-95 origin-left ${
            alignTop ? 'top-0' : 'bottom-0'
          }`}
          style={{ animationDuration: '150ms' }}
        >
          <div className="px-4 py-3 border-b border-[#F5F6FA]">
            <div className="text-sm font-semibold text-[#2D3436] truncate">
              {userName}
            </div>
            <div className="text-xs text-[#B2BEC3] mt-0.5">{userRole || '普通用户'}</div>
          </div>

          <div className="py-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => handleItemClick(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] hover:bg-[#F5F6FA] transition-colors text-left"
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: item.color ?? '#6C5CE7' }}
                  />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#B2BEC3]" />
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#F5F6FA] pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#E17055] hover:bg-[#E17055]/5 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenuPopover;
