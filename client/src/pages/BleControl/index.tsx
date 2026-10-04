import {
  Radio,
  Satellite,
  Monitor,
  Database,
  LayoutDashboard,
  Sparkles,
  MapPin,
  ExternalLink,
  Bluetooth,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const BLE_URL = 'https://echofind.1752473652.workers.dev/';

const flowSteps = [
  {
    icon: Radio,
    title: 'BLE 贴纸',
    desc: '贴在物品上',
    gradient: 'from-[#6C5CE7] to-[#A29BFE]',
    glow: 'rgba(108, 92, 231, 0.35)',
  },
  {
    icon: Satellite,
    title: 'ESP32 基站',
    desc: '接收信号',
    gradient: 'from-[#74B9FF] to-[#0984E3]',
    glow: 'rgba(116, 185, 255, 0.35)',
  },
  {
    icon: Monitor,
    title: '电脑上传',
    desc: '连接电脑 / 上传数据',
    gradient: 'from-[#00B894] to-[#55EFC4]',
    glow: 'rgba(0, 184, 148, 0.35)',
  },
  {
    icon: Database,
    title: '飞书多维表格',
    desc: '数据底座',
    gradient: 'from-[#FDCB6E] to-[#E17055]',
    glow: 'rgba(253, 203, 110, 0.35)',
  },
  {
    icon: LayoutDashboard,
    title: '中控台',
    desc: '实时处理',
    gradient: 'from-[#A29BFE] to-[#6C5CE7]',
    glow: 'rgba(162, 155, 254, 0.35)',
  },
  {
    icon: Sparkles,
    title: 'AI 小寻思考',
    desc: '智能分析',
    gradient: 'from-[#E17055] to-[#D63031]',
    glow: 'rgba(225, 112, 85, 0.35)',
  },
  {
    icon: MapPin,
    title: '推荐位置',
    desc: '客厅 / 卧室 / 储物柜',
    gradient: 'from-[#00B894] to-[#00CEC9]',
    glow: 'rgba(0, 184, 148, 0.35)',
  },
];

const BleControl: React.FC = () => {
  const handleOpen = (): void => {
    window.open(BLE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full h-full -m-6 overflow-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-br from-[#F5F6FA] via-white to-[#E8E5FF]/40">
        {/* Hero 区 */}
        <div className="w-full max-w-2xl text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] shadow-[0_8px_32px_rgba(108_92_231_0.25)] mb-8">
            <Bluetooth className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-[#2D3436] mb-4 tracking-tight">
            BLE 找物控制
          </h1>
          <p className="text-base text-[#636E72] leading-relaxed max-w-lg mx-auto mb-8">
            ESP32 贴纸的实时信号扫描与找物引导页面。
            由于浏览器蓝牙权限限制，需要在新标签页中独立打开，
            才能调用手机或电脑的蓝牙功能进行近距离扫描。
          </p>

          <Button
            onClick={handleOpen}
            size="lg"
            className="h-12 px-8 text-base font-medium bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white shadow-[0_4px_20px_rgba(108_92_231_0.35)] transition-shadow hover:shadow-[0_6px_24px_rgba(108_92_231_0.45)]"
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            打开 BLE 找物
          </Button>

          <p className="text-xs text-[#B2BEC3] mt-4">
            将在新标签页中打开 · 需要授权蓝牙权限
          </p>
        </div>

        {/* 数据流程图 */}
        <div className="w-full max-w-6xl bg-gradient-to-br from-white to-[#F8F9FD] rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] p-8 border border-[#DFE6E9]/50">
          <div className="text-center mb-10">
            <h2 className="text-lg font-semibold text-[#2D3436] mb-2">
              产品数据链路
            </h2>
            <p className="text-sm text-[#636E72]">
              从贴纸信号到 AI 推荐，全流程实时贯通
            </p>
          </div>

          {/* 桌面：横向 */}
          <div className="hidden md:block relative">
            <div className="flex items-start justify-between px-2">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center relative"
                    style={{ width: '13%' }}
                  >
                    <div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center relative`}
                      style={{
                        boxShadow: `0 8px 24px ${step.glow}, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)`,
                      }}
                    >
                      <Icon className="w-9 h-9 text-white drop-shadow-sm" />
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/40"
                        style={{ backdropFilter: 'blur(2px)' }}
                      />
                    </div>
                    <div className="mt-3 text-center">
                      <div className="text-sm font-semibold text-[#2D3436]">
                        {step.title}
                      </div>
                      <div className="text-xs text-[#B2BEC3] mt-0.5">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 连线 SVG 层 */}
            <svg
              className="absolute top-20 left-0 w-full pointer-events-none"
              viewBox="0 0 1000 40"
              preserveAspectRatio="none"
              style={{ height: '40px' }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#A29BFE" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#00B894" stopOpacity="0.4" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {[0, 1, 2, 3, 4, 5].map((i) => {
                const startX = (i * 2 + 1.65) * 1000 / 14;
                const endX = ((i + 1) * 2 + 0.35) * 1000 / 14;
                const midY = 20;
                const pathD = `M ${startX} ${midY} C ${startX + 30} ${midY}, ${endX - 30} ${midY}, ${endX} ${midY}`;
                return (
                  <g key={i}>
                    <path
                      d={pathD}
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <circle r="4" fill="#6C5CE7" filter="url(#glow)">
                      <animateMotion
                        dur="2.4s"
                        repeatCount="indefinite"
                        begin={`${i * 0.35}s`}
                        path={pathD}
                      />
                    </circle>
                    <circle r="2" fill="#ffffff" opacity="0.9">
                      <animateMotion
                        dur="2.4s"
                        repeatCount="indefinite"
                        begin={`${i * 0.35}s`}
                        path={pathD}
                      />
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 移动端：竖向 */}
          <div className="md:hidden flex flex-col items-center gap-6 relative">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="flex flex-col items-center relative">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center relative`}
                    style={{
                      boxShadow: `0 6px 20px ${step.glow}, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)`,
                    }}
                  >
                    <Icon className="w-7 h-7 text-white drop-shadow-sm" />
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-semibold text-[#2D3436]">
                      {step.title}
                    </div>
                    <div className="text-xs text-[#B2BEC3]">
                      {step.desc}
                    </div>
                  </div>
                  {index < flowSteps.length - 1 && (
                    <div className="relative w-0.5 h-8 mt-4 bg-gradient-to-b from-[#6C5CE7]/40 to-[#A29BFE]/40 overflow-visible">
                      <div
                        className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#6C5CE7] shadow-[0_0_8px_rgba(108_92_231_0.6)]"
                        style={{
                          animation: `flowDown 2s ease-in-out infinite`,
                          animationDelay: `${index * 0.3}s`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes flowDown {
          0% { top: -4px; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: calc(100% + 4px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default BleControl;
