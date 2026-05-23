import { useState, useEffect } from 'react';
import type { Show } from '../types';
import { useShowStore } from '../store/showStore';
import ShowTabBar from '../components/show/ShowTabBar';
import TabOrderSheet from '../components/show/TabOrderSheet';
import AddShowSheet from '../components/show/AddShowSheet';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BottomNav from '../components/common/BottomNav';
import PlannerTab from '../tabs/PlannerTab';
import StatusTab from '../tabs/StatusTab';
import SettingsTab from '../tabs/SettingsTab';
import StorageManageSheet from '../components/settings/StorageManageSheet';
import { useStorageAlertStore } from '../store/storageAlertStore';
import { isNoUseBenefit, isCouponBenefit } from '../utils/benefitUtils';
import { useSettingsStore } from '../store/settingsStore';
import { scheduleNotifications } from '../utils/notifications';

type TabType = 'planner' | 'status' | 'settings';

interface MainScreenProps {
  shows: Show[];
}

/** 메인 화면 */
export default function MainScreen({ shows }: MainScreenProps) {
  const { addShow, updateShow, deleteShow, archiveShow, reorderShows, recalcBenefits } = useShowStore();
  const { manageSheetOpen } = useStorageAlertStore();
  const [activeShowId, setActiveShowId] = useState<string | null>(
    shows.filter(s => !s.isArchived)[0]?.id || null
  );
  const [activeTab, setActiveTab] = useState<TabType>('planner');
  const [addShowOpen, setAddShowOpen] = useState(false);
  const [deleteTargetShow, setDeleteTargetShow] = useState<Show | null>(null);
  const [editTargetShow, setEditTargetShow] = useState<Show | null>(null);
  const [tabOrderOpen, setTabOrderOpen] = useState(false);

  const visibleShows = shows.filter(s => !s.isArchived);
  const activeShow = visibleShows.find(s => s.id === activeShowId) || visibleShows[0] || null;

  // 미사용 달성 혜택 수 (활성 공연 기준, 수집형·쿠폰형 혜택 제외)
  const unusedBenefitCount = activeShow
    ? activeShow.stampBoards.flatMap(b => b.benefits).filter(
        b => b.isAchieved && !b.isUsed && !isNoUseBenefit(b.description) && !isCouponBenefit(b.description)
      ).length
    : 0;

  // 앱 실행 시 날짜가 도래한 예비 도장 혜택 재계산 + 알림 스케줄 등록
  useEffect(() => {
    recalcBenefits();
    const { shows: allShows, schedules: allSchedules } = useShowStore.getState();
    const { settings } = useSettingsStore.getState();
    if (settings.notification) {
      scheduleNotifications(allSchedules, allShows, settings.notification);
    }
  }, []);

  // 공연이 추가되거나 활성 공연이 사라질 때 자동 선택
  useEffect(() => {
    if (!activeShowId && visibleShows.length > 0) {
      setActiveShowId(visibleShows[0].id);
    }
  }, [shows, activeShowId]);

  return (
    <div data-testid="main" className="flex flex-col h-dvh bg-gray-50">
      {/* 상단 헤더 */}
      <header data-testid="app-header" className="sticky top-0 z-20 bg-white shadow-sm">
        <ShowTabBar
          shows={shows}
          activeShowId={activeShowId}
          onSelect={setActiveShowId}
          onAddShow={() => setAddShowOpen(true)}
          onEditShow={(id) => {
            const show = shows.find(s => s.id === id) || null;
            setEditTargetShow(show);
          }}
          onArchiveShow={archiveShow}
          onDeleteShow={(id) => {
            const show = shows.find(s => s.id === id) || null;
            setDeleteTargetShow(show);
          }}
          onOpenTabOrder={() => setTabOrderOpen(true)}
        />
      </header>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!activeShow ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <svg className="mb-4" width="100" height="80" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 장식 별 — 오른쪽 위 (amber) */}
              <polygon points="76,7 77.4,11.2 81.8,11.2 78.2,13.8 79.6,18 76,15.4 72.4,18 73.8,13.8 70.2,11.2 74.6,11.2" fill="#fbbf24" opacity="0.9"/>
              {/* 장식 별 — 오른쪽 아래 (lavender) */}
              <polygon points="84,57 84.9,59.7 87.8,59.7 85.6,61.3 86.5,64 84,62.4 81.5,64 82.4,61.3 80.2,59.7 83.1,59.7" fill="#a5b4fc" opacity="0.85"/>
              {/* 장식 별 — 왼쪽 위 (tiny amber) */}
              <polygon points="10,6 10.7,8.1 12.9,8.1 11.1,9.4 11.8,11.5 10,10.2 8.2,11.5 8.9,9.4 7.1,8.1 9.3,8.1" fill="#fbbf24" opacity="0.55"/>

              {/* 티켓 몸통 */}
              <rect x="8" y="18" width="84" height="44" rx="9" fill="#6366f1"/>

              {/* 노치 — 왼쪽/오른쪽 반원 (배경색 #f9fafb) */}
              <circle cx="8" cy="40" r="7" fill="#f9fafb"/>
              <circle cx="92" cy="40" r="7" fill="#f9fafb"/>

              {/* 세로 점선 구분선 */}
              <line x1="28" y1="22" x2="28" y2="58" stroke="white" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.45"/>

              {/* 왼쪽 스텁 — SVG 별 도형 (amber) */}
              <polygon
                points="18,29 19.8,34.6 25.6,34.8 21,38.2 22.8,43.8 18,40.4 13.2,43.8 15,38.2 10.4,34.8 16.2,34.6"
                fill="#fbbf24"
              />

              {/* 오른쪽 영역 — 줄무늬 */}
              <rect x="34" y="26" width="34" height="4.5" rx="2.2" fill="white" opacity="0.55"/>
              <rect x="34" y="35" width="24" height="3.5" rx="1.8" fill="white" opacity="0.4"/>
              <rect x="34" y="43" width="28" height="3.5" rx="1.8" fill="white" opacity="0.35"/>
              <rect x="34" y="51" width="18" height="3.5" rx="1.8" fill="white" opacity="0.25"/>

              {/* 티켓 상단 하이라이트 */}
              <ellipse cx="68" cy="23" rx="10" ry="2.5" fill="white" opacity="0.12" transform="rotate(-10 68 23)"/>
            </svg>
            <p className="text-base font-medium mb-1">공연을 추가해보세요</p>
            <p className="text-sm text-center">위의 + 버튼으로 관람하는 공연을 추가하면<br/>도장판을 관리할 수 있어요</p>
            <button
              onClick={() => setAddShowOpen(true)}
              className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold min-h-[44px]"
            >
              공연 추가하기
            </button>
          </div>
        ) : (
          <>
            {/* 공연 상단 이미지 배너 */}
            {activeShow.headerImageUrl && (
              <div className="shrink-0 w-full h-28 overflow-hidden">
                <img
                  src={activeShow.headerImageUrl}
                  alt={activeShow.name}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  draggable="false"
                />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'planner' && (
                <PlannerTab
                  show={activeShow}
                  onGoToSettings={() => setActiveTab('settings')}
                  onGoToStatus={(benefitId) => {
                    setActiveTab('status');
                    if (benefitId) {
                      setTimeout(() => {
                        const el = document.querySelector(`[data-benefit-id="${benefitId}"]`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 200);
                    }
                  }}
                />
              )}
              {activeTab === 'status' && <StatusTab show={activeShow} onGoToPlanner={() => setActiveTab('planner')} />}
              {activeTab === 'settings' && <SettingsTab show={activeShow} onOpenTabOrder={() => setTabOrderOpen(true)} />}
            </div>
          </>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        statusBadge={unusedBenefitCount}
      />

      <AddShowSheet
        isOpen={addShowOpen}
        onClose={() => setAddShowOpen(false)}
        onSubmit={(data) => {
          const id = addShow(data);
          setActiveShowId(id);
          setAddShowOpen(false);
        }}
      />

      <AddShowSheet
        isOpen={!!editTargetShow}
        mode="edit"
        initialData={editTargetShow ? {
          name: editTargetShow.name,
          venue: editTargetShow.venue,
          startDate: editTargetShow.startDate,
          endDate: editTargetShow.endDate,
          color: editTargetShow.color,
          headerImageUrl: editTargetShow.headerImageUrl,
        } : undefined}
        onClose={() => setEditTargetShow(null)}
        onSubmit={(data) => {
          if (editTargetShow) {
            updateShow(editTargetShow.id, {
              name: data.name,
              venue: data.venue,
              startDate: data.startDate,
              endDate: data.endDate,
              color: data.color,
              headerImageUrl: data.headerImageUrl,
            });
          }
          setEditTargetShow(null);
        }}
      />

      {/* 저장 공간 관리 시트 (전역 — 어느 탭에서도 강제 표시 가능) */}
      <StorageManageSheet isOpen={manageSheetOpen} />

      {/* 4.16 공연 탭 순서 변경 시트 */}
      <TabOrderSheet
        isOpen={tabOrderOpen}
        shows={visibleShows}
        onClose={() => setTabOrderOpen(false)}
        onSave={(orderedIds) => reorderShows(orderedIds)}
      />

      <ConfirmDialog
        isOpen={!!deleteTargetShow}
        title="공연 삭제"
        message={`"${deleteTargetShow?.name}" 공연을 삭제할까요?\n관련된 모든 일정과 도장판 데이터가 함께 삭제되며, 복구할 수 없어요.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmDestructive
        confirmTestId="btn-delete-show-confirm"
        onCancel={() => setDeleteTargetShow(null)}
        onConfirm={() => {
          if (deleteTargetShow) {
            deleteShow(deleteTargetShow.id);
            if (activeShowId === deleteTargetShow.id) {
              const remaining = visibleShows.filter(s => s.id !== deleteTargetShow.id);
              setActiveShowId(remaining[0]?.id || null);
            }
          }
          setDeleteTargetShow(null);
        }}
      />
    </div>
  );
}
