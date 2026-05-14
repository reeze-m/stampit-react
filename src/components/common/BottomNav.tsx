import { colors } from '../../constants/tokens';

type TabType = 'planner' | 'status' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  statusBadge?: number; // unusedBenefitCount
}

/** V-11: 하단 탭 네비게이터 */
export default function BottomNav({ activeTab, onTabChange, statusBadge = 0 }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16">

        {/* 플래너 탭 */}
        <button
          data-testid="tab-planner"
          onClick={() => onTabChange('planner')}
          className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-60"
        >
          <div className={activeTab === 'planner' ? 'bg-indigo-50 rounded-[14px] px-[18px] py-1' : 'py-1 px-[18px]'}>
            <svg
              width={activeTab === 'planner' ? 22 : 24}
              height={activeTab === 'planner' ? 22 : 24}
              viewBox="0 0 24 24" fill="none"
              stroke={activeTab === 'planner' ? colors.primary[600] : colors.gray[400]}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className={`text-[11px] ${activeTab === 'planner' ? 'font-semibold text-indigo-600' : 'text-gray-400'}`}>
            플래너
          </span>
        </button>

        {/* 현황 탭 */}
        <button
          data-testid="tab-status"
          onClick={() => onTabChange('status')}
          className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-60"
        >
          <div className={`relative ${activeTab === 'status' ? 'bg-indigo-50 rounded-[14px] px-[18px] py-1' : 'py-1 px-[18px]'}`}>
            <svg
              width={activeTab === 'status' ? 22 : 24}
              height={activeTab === 'status' ? 22 : 24}
              viewBox="0 0 24 24" fill="none"
              stroke={activeTab === 'status' ? colors.primary[600] : colors.gray[400]}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="5" cy="5" r="2"/>
              <circle cx="12" cy="5" r="2"/>
              <circle cx="19" cy="5" r="2"/>
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
              <circle cx="5" cy="19" r="2"/>
              <circle cx="12" cy="19" r="2"/>
              <circle cx="19" cy="19" r="2"/>
            </svg>
            {statusBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] min-h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-[3px] py-[1px] leading-none border-2 border-white">
                {statusBadge > 99 ? '99+' : statusBadge}
              </span>
            )}
          </div>
          <span className={`text-[11px] ${activeTab === 'status' ? 'font-semibold text-indigo-600' : 'text-gray-400'}`}>
            현황
          </span>
        </button>

        {/* 설정 탭 */}
        <button
          data-testid="tab-settings"
          onClick={() => onTabChange('settings')}
          className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-60"
        >
          <div className={activeTab === 'settings' ? 'bg-indigo-50 rounded-[14px] px-[18px] py-1' : 'py-1 px-[18px]'}>
            <svg
              width={activeTab === 'settings' ? 22 : 24}
              height={activeTab === 'settings' ? 22 : 24}
              viewBox="0 0 24 24" fill="none"
              stroke={activeTab === 'settings' ? colors.primary[600] : colors.gray[400]}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="9" cy="6" r="2" fill="white"/>
              <circle cx="15" cy="12" r="2" fill="white"/>
              <circle cx="9" cy="18" r="2" fill="white"/>
            </svg>
          </div>
          <span className={`text-[11px] ${activeTab === 'settings' ? 'font-semibold text-indigo-600' : 'text-gray-400'}`}>
            설정
          </span>
        </button>

      </div>
    </nav>
  );
}
