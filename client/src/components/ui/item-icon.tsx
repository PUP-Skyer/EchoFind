import React from 'react';

const ITEM_ICON_MAP: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ['雨伞', '伞', '阳伞'], emoji: '☂️' },
  { keywords: ['身份证', '身份证件'], emoji: '🪪' },
  { keywords: ['手机', '电话', 'iPhone', '安卓'], emoji: '📱' },
  { keywords: ['钥匙扣', '钥匙串'], emoji: '🔑' },
  { keywords: ['家门钥匙', '家门匙', '大门钥匙'], emoji: '🗝️' },
  { keywords: ['钥匙'], emoji: '🔑' },
  { keywords: ['钱包', '皮夹子'], emoji: '👛' },
  { keywords: ['充电宝', '移动电源', '充電寶'], emoji: '🔋' },
  { keywords: ['工牌', '胸牌', '员工证', '工卡'], emoji: '🪪' },
  { keywords: ['耳机', 'airpods', 'AirPods', '藍牙耳機', '蓝牙耳机', '耳麦'], emoji: '🎧' },
  { keywords: ['门禁卡', '门卡', '门禁'], emoji: '💳' },
  { keywords: ['银行卡', '信用卡', '储蓄卡'], emoji: '💳' },
  { keywords: ['水杯', '杯子', '保温杯', '水壶'], emoji: '🥤' },
  { keywords: ['手表', '腕表', 'watch'], emoji: '⌚' },
  { keywords: ['眼镜', '太阳镜', '墨镜', '近視眼鏡'], emoji: '👓' },
  { keywords: ['帽子', '鸭舌帽', '棒球帽', '草帽'], emoji: '🧢' },
  { keywords: ['手套', '手套儿'], emoji: '🧤' },
  { keywords: ['围巾', '围脖'], emoji: '🧣' },
  { keywords: ['书', '笔记本', '课本', '書本'], emoji: '📚' },
  { keywords: ['笔', '钢笔', '铅笔', '圆珠笔'], emoji: '🖊️' },
  { keywords: ['电脑', '笔记本电脑', 'laptop', 'macbook'], emoji: '💻' },
  { keywords: ['平板', 'iPad', 'ipad'], emoji: '📱' },
  { keywords: ['相机', '照相机', '相机包'], emoji: '📷' },
  { keywords: ['书包', '背包', '双肩包', 'backpack'], emoji: '🎒' },
  { keywords: ['手提包', '包包', '挎包', '单肩包', 'purse', 'bag'], emoji: '👜' },
  { keywords: ['行李箱', '拉杆箱', '旅行箱'], emoji: '🧳' },
  { keywords: ['药', '药品', '药盒', '药丸'], emoji: '💊' },
  { keywords: ['口红', '唇膏', '唇釉'], emoji: '💄' },
  { keywords: ['香水'], emoji: '🧴' },
  { keywords: ['纸巾', '卫生纸', '手帕纸'], emoji: '🧻' },
  { keywords: ['口罩'], emoji: '😷' },
  { keywords: ['尺子', '直尺'], emoji: '📏' },
  { keywords: ['剪刀'], emoji: '✂️' },
  { keywords: ['胶带', '胶布'], emoji: '📎' },
  { keywords: ['便签', '便利贴', 'sticky'], emoji: '🗒️' },
  { keywords: ['计算器'], emoji: '🧮' },
  { keywords: ['U盘', 'u盘', '优盘', 'USB', 'usb'], emoji: '💾' },
  { keywords: ['鼠标', 'mouse'], emoji: '🖱️' },
  { keywords: ['键盘', 'keyboard'], emoji: '⌨️' },
  { keywords: ['充电器', '充电头', '插头'], emoji: '🔌' },
  { keywords: ['数据线', '充电线', 'type c', 'Type-C'], emoji: '🔌' },
  { keywords: ['梳子', '镜子'], emoji: '🪞' },
  { keywords: ['皮筋', '头绳', '发圈'], emoji: '🎀' },
  { keywords: ['零食', '吃的', '小零食'], emoji: '🍪' },
  { keywords: ['巧克力', 'chocolate'], emoji: '🍫' },
  { keywords: ['糖果', '糖'], emoji: '🍬' },
  { keywords: ['咖啡', 'coffee'], emoji: '☕' },
  { keywords: ['饭盒', '便当', '午餐盒'], emoji: '🍱' },
  { keywords: ['勺子', '筷子', '餐具'], emoji: '🥢' },
  { keywords: ['钥匙', 'key'], emoji: '🔑' },
];

export function getItemEmoji(name: string): string {
  if (!name) return '📦';
  const lower = name.toLowerCase();
  for (const entry of ITEM_ICON_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return entry.emoji;
      }
    }
  }
  return '📦';
}

interface ItemIconProps {
  name: string;
  size?: number;
  className?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ name, size = 24, className = '' }) => {
  const emoji = getItemEmoji(name);
  const fontSize = Math.round(size * 0.7);
  return (
    <div
      className={`flex items-center justify-center bg-[#F5F6FA] rounded-lg ${className}`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
      aria-label={name}
    >
      <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}>{emoji}</span>
    </div>
  );
};

export default ItemIcon;
