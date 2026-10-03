import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Radar,
  LayoutDashboard,
  Activity,
  Package,
  Radio,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Search,
} from 'lucide-react';
import { XiaoxunAssistant } from '@client/src/components/xiaoxun';
import UserMenuPopover from '@client/src/components/UserMenuPopover';
import { Input } from '@client/src/components/ui/input';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const mainMenuItems: MenuItem[] = [
  {
    path: '/dashboard',
    label: '概览',
    icon: <LayoutDashboard size={18} />,
  },
  {
    path: '/dataflow',
    label: '数据流',
    icon: <Activity size={18} />,
  },
  {
    path: '/items',
    label: '物品管理',
    icon: <Package size={18} />,
  },
  {
    path: '/devices',
    label: '设备管理',
    icon: <Radio size={18} />,
  },
  {
    path: '/alerts',
    label: '告警日志',
    icon: <AlertTriangle size={18} />,
  },
  {
    path: '/statistics',
    label: '统计看板',
    icon: <BarChart3 size={18} />,
  },
  {
    path: '/schedule',
    label: '日程清单',
    icon: <CalendarDays size={18} />,
  },
];

const bottomMenuItems: MenuItem[] = [
];

const Sidebar = () => {
  const renderMenuItem = (item: MenuItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-4 py-3 text-base rounded-xl transition-all duration-200 ${
          isActive
            ? 'text-[#6C5CE7] bg-[#6C5CE710] font-medium shadow-sm'
            : 'text-[#636E72] hover:bg-[#F5F6FA] hover:text-[#2D3436]'
        }`
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <aside className="flex-shrink-0 w-[280px] h-full flex flex-col p-4 gap-4">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <Radar size={28} className="text-[#6C5CE7]" />
        <span className="text-xl font-bold text-[#2D3436]">EchoFind</span>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 py-4 px-3 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex flex-col gap-1">
        {mainMenuItems.map(renderMenuItem)}
      </nav>

      {/* Bottom Menu */}
      <div className="py-4 px-3 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex flex-col gap-2">
        <UserMenuPopover userName="蒲承玺" userRole="管理员" />
      </div>
    </aside>
  );
};

const TopBar = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = React.useState('');

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    const q = keyword.trim();
    if (q) {
      navigate(`/items?search=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header className="h-14 flex-shrink-0 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex items-center justify-between px-6 gap-4">
      <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B2BEC3]" />
        <Input
          type="search"
          placeholder="搜索物品名称或编号..."
          value={keyword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setKeyword(e.target.value)}
          className="w-full pl-9 bg-[#F5F6FA] border-transparent focus-visible:ring-[#6C5CE7]"
        />
      </form>
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-[#F5F6FA] transition-colors text-[#636E72]">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E17055] rounded-full border-2 border-white" />
        </button>

        {/* User Avatar Placeholder */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white text-sm font-medium cursor-pointer">
          U
        </div>
      </div>
    </header>
  );
};

const Layout = () => {
  return (
    <div className="w-screen h-screen flex bg-[#F5F6FA] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden pr-4 py-3 gap-3">
        <div className="px-3">
          <TopBar />
        </div>
        <main className="flex-1 overflow-auto p-6 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] mx-3">
          <Outlet />
        </main>
      </div>
      <XiaoxunAssistant />
    </div>
  );
};

export default Layout;
