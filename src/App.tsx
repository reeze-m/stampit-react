import { useState, useEffect } from 'react';
import { useShowStore } from './store/showStore';
import { useSettingsStore } from './store/settingsStore';
import { useErrorToastStore } from './store/errorToastStore';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainScreen from './screens/MainScreen';
import QuickStartSheet from './components/show/QuickStartSheet';
import ArchivePromptSheet from './components/show/ArchivePromptSheet';
import ShowReportSheet from './components/archive/ShowReportSheet';
import Toast from './components/common/Toast';
import { todayKSTString } from './utils/dateUtils';

type AppState = 'splash' | 'onboarding' | 'main';

/** 메인 앱 컴포넌트 */
export default function App() {
  const { shows, addShow, addStampBoard, archiveShow, dismissArchivePrompt, refreshBenefits, pendingReportShowId, clearPendingReport } = useShowStore();
  const { settings, setOnboardingDone, setQuickStartDone } = useSettingsStore();
  const { message: errorMessage, clear: clearError } = useErrorToastStore();

  const [phase, setPhase] = useState<AppState>('splash');
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  // 아카이브 제안 큐
  const [archiveQueue, setArchiveQueue] = useState<string[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveToast, setArchiveToast] = useState('');

  // 스플래시 완료 → 메인 진입 시 종료 공연 감지
  function detectExpiredShows() {
    const today = todayKSTString();
    const expired = shows.filter(
      s =>
        !s.isArchived &&
        !s.isCancelled &&
        !s.archivePromptDismissed &&
        !!s.endDate &&
        s.endDate < today
    );
    if (expired.length > 0) {
      const ids = expired.map(s => s.id);
      setArchiveQueue(ids);
      setArchiveTotal(ids.length);
    }
  }

  function handleSplashDone() {
    if (!settings.onboardingDone) {
      setPhase('onboarding');
    } else {
      setPhase('main');
      detectExpiredShows();
    }
  }

  function handleInlineQuickStart(name: string) {
    setOnboardingDone();
    const showId = addShow({
      name,
      venue: undefined,
      startDate: '',
      endDate: '',
      color: '#6366f1',
      seatGrades: [],
      discountTypes: [],
    });
    addStampBoard(showId, {
      name: '1판',
      capacity: 7,
      initialStamps: 0,
      benefits: [],
    });
    setQuickStartDone();
    setPhase('main');
  }

  function handleOnboardingDone() {
    setOnboardingDone();
    setPhase('main');
    detectExpiredShows();
  }

  function handleQuickStart() {
    setOnboardingDone();
    setQuickStartOpen(true);
    setPhase('main');
  }

  function handleQuickStartSubmit(data: {
    showName: string;
    capacity: number;
    benefits: { requiredStamps: number; description: string; priority: number }[];
    initialStamps: number;
  }) {
    const showId = addShow({
      name: data.showName,
      venue: undefined,
      startDate: '',
      endDate: '',
      color: '#6366f1',
      seatGrades: [],
      discountTypes: [],
    });

    addStampBoard(showId, {
      name: '1판',
      capacity: data.capacity,
      initialStamps: data.initialStamps,
      benefits: data.benefits.map((b, i) => ({
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        requiredStamps: b.requiredStamps,
        description: b.description,
        priority: i + 1,
        isAchieved: false,
        isUsed: false,
      })),
    });

    setQuickStartDone();
    setQuickStartOpen(false);
  }

  // 아카이브 큐에서 현재 표시할 공연
  const currentArchiveId = archiveQueue[0] ?? null;
  const currentArchiveShow = currentArchiveId
    ? shows.find(s => s.id === currentArchiveId) ?? null
    : null;

  function advanceQueue() {
    setArchiveQueue(q => q.slice(1));
  }

  function handleArchive(showId: string) {
    const show = shows.find(s => s.id === showId);
    archiveShow(showId);
    if (show) setArchiveToast(`${show.name}이(가) 보관되었습니다`);
    advanceQueue();
  }

  function handleDismiss(showId: string) {
    dismissArchivePrompt(showId);
    advanceQueue();
  }

  // shows가 로드된 후 phase가 main이면 한 번만 감지 (스플래시 없이 hot-reload 시 대비)
  useEffect(() => {
    if (phase === 'main' && archiveQueue.length === 0) {
      detectExpiredShows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 앱 시작 시 날짜 기반 혜택 달성 재계산 (미래 확정 일정 날짜가 지났을 때 자동 반영)
  useEffect(() => {
    if (phase === 'main') {
      refreshBenefits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'splash') {
    return <SplashScreen onDone={handleSplashDone} />;
  }

  if (phase === 'onboarding') {
    return (
      <>
        <OnboardingScreen
          onDone={handleOnboardingDone}
          onQuickStart={handleQuickStart}
          onInlineQuickStart={handleInlineQuickStart}
        />
        <QuickStartSheet
          isOpen={quickStartOpen}
          onClose={() => setQuickStartOpen(false)}
          onSubmit={handleQuickStartSubmit}
        />
      </>
    );
  }

  return (
    <>
      <MainScreen shows={shows} />
      <QuickStartSheet
        isOpen={quickStartOpen}
        onClose={() => setQuickStartOpen(false)}
        onSubmit={handleQuickStartSubmit}
      />

      {/* 아카이브 제안 시트 */}
      {currentArchiveShow && (
        <ArchivePromptSheet
          show={currentArchiveShow}
          current={archiveTotal - archiveQueue.length + 1}
          total={archiveTotal}
          onArchive={handleArchive}
          onDismiss={handleDismiss}
        />
      )}

      {archiveToast && (
        <Toast
          message={archiveToast}
          type="success"
          onClose={() => setArchiveToast('')}
        />
      )}

      {errorMessage && (
        <Toast
          message={errorMessage}
          type="error"
          onClose={clearError}
        />
      )}

      {/* 아카이브 직후 리포트 자동 표시 */}
      {(() => {
        const reportShow = pendingReportShowId
          ? shows.find(s => s.id === pendingReportShowId) ?? null
          : null;
        return reportShow ? (
          <ShowReportSheet
            isOpen={true}
            onClose={clearPendingReport}
            show={reportShow}
          />
        ) : null;
      })()}
    </>
  );
}
