import type { AppApi } from '../App';
import { fmt } from '../engine/engine';
import { Emblem } from './common';

export function Home({ api }: { api: AppApi }) {
  const g = api.game;
  const canResume = !!g && g.phase !== 'finished';
  const newBattle = () => {
    if (canResume) {
      api.confirm({
        title: 'بدء معركة جديدة؟',
        message: 'توجد مباراة محفوظة لم تنتهِ. إعداد معركة جديدة سيستبدلها عند البدء.',
        confirmLabel: 'متابعة إلى الإعداد',
        onConfirm: () => api.go('setup'),
      });
    } else api.go('setup');
  };
  return (
    <main className="home">
      <div className="home-hero">
        <div className="home-badge"><Emblem id="shield" color="#3ef08a" size={92} /></div>
        <p className="eyebrow">غرفة العمليات جاهزة</p>
        <h1 className="game-title">معركة المعرفة</h1>
        <p className="tagline">اجمعوا جنودكم بالمعرفة، واحسموا المعركة بالسرعة.</p>
        <nav className="home-actions" aria-label="القائمة الرئيسية">
          <button className="btn primary xl" onClick={newBattle}>معركة جديدة</button>
          {canResume && (
            <button className="btn gold xl" onClick={() => api.go('game')}>
              استكمال المباراة
              <small>الجولة {fmt(g!.round)} · {g!.teams.length.toLocaleString('ar-EG')} جيوش</small>
            </button>
          )}
          <button className="btn outline lg" onClick={() => api.go('bank')}>بنك الأسئلة <small>{fmt(api.bank.length)} سؤالًا</small></button>
          <button className="btn outline lg" onClick={() => api.go('rules')}>قواعد اللعب</button>
        </nav>
      </div>
      <p className="home-foot">يُدار من جهاز المقدّم ويُعرض على الشاشة الكبيرة · لا حاجة لحسابات أو هواتف</p>
    </main>
  );
}
