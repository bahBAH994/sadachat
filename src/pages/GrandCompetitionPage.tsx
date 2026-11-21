import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Coins,
  Crown,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

const CompetitionInfoCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone: string;
}> = ({ icon, title, children, tone }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2.5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
        {icon}
      </div>
      <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
);

export const GrandCompetitionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-50 via-slate-50 to-slate-50 px-4 pb-8 pt-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>

        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#082B23] via-[#0F513D] to-[#172554] p-5 text-white shadow-xl">
          <div className="pointer-events-none absolute -left-8 -top-10 h-40 w-40 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200/50 bg-amber-300/15 text-amber-200 shadow-lg">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-100">التحدي الأسبوعي والختام الشهري</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">مسابقة صدى الكبرى</h1>
              <p className="mt-2 text-xs leading-6 text-slate-200">
                مساحة تنافسية لمجتمع صدى، تجمع المشاركات والتحديات في دورات أسبوعية وختامية شهرية.
                تابع إعلانات المسابقة لمعرفة تفاصيل كل دورة قبل التسجيل.
              </p>
            </div>
          </div>
        </header>

        <CompetitionInfoCard
          icon={<Trophy className="h-5 w-5" />}
          title="نبذة عن المسابقة"
          tone="bg-emerald-50 text-emerald-700"
        >
          <p className="text-xs leading-6 text-slate-600">
            تُنظَّم المنافسة على مراحل أسبوعية، مع دورة شهرية ختامية وفق إعلان المنظمين. تعرض صفحة
            المسابقات التحديات المتاحة، أما تفاصيل الجولة وطريقة احتساب نتيجتها فتُوضح في إعلانها
            الرسمي.
          </p>
        </CompetitionInfoCard>

        <section className="grid gap-3 sm:grid-cols-2">
          <CompetitionInfoCard
            icon={<Coins className="h-5 w-5" />}
            title="جوائز الدورة الأسبوعية"
            tone="bg-amber-50 text-amber-700"
          >
            <p className="text-xs leading-6 text-slate-600">
              تشمل الجوائز كوينز وأوسمة بحسب إعلان الدورة. لم تُضبط قيمة موثقة للجوائز الأسبوعية في
              إعدادات التطبيق؛ راجع الإعلان الرسمي قبل المشاركة.
            </p>
          </CompetitionInfoCard>
          <CompetitionInfoCard
            icon={<Crown className="h-5 w-5" />}
            title="جوائز الختام الشهري"
            tone="bg-violet-50 text-violet-700"
          >
            <p className="text-xs leading-6 text-slate-600">
              يعلن المنظمون جوائز الكوينز والأوسمة وشروط الفوز للدورة الشهرية عند فتحها. لا تعرض
              المنصة حالياً مبالغ أو أوسمة شهرية مؤكدة.
            </p>
          </CompetitionInfoCard>
        </section>

        <CompetitionInfoCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="شروط التأهل والمشاركة"
          tone="bg-sky-50 text-sky-700"
        >
          <ul className="space-y-2 text-xs leading-6 text-slate-600">
            <li className="flex gap-2"><BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />الدخول إلى حساب صدى والمشاركة من التحدي المفتوح داخل صفحة المسابقات.</li>
            <li className="flex gap-2"><BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />الالتزام بتعليمات كل جولة ومواعيدها كما تظهر في إعلانها الرسمي.</li>
            <li className="flex gap-2"><BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />تُحتسب النتائج والأهلية وفق قواعد الدورة المنشورة؛ لا تُعد هذه الصفحة بديلاً عن شروط الإعلان.</li>
          </ul>
        </CompetitionInfoCard>

        <CompetitionInfoCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="جدول المواعيد"
          tone="bg-rose-50 text-rose-700"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-3 bg-slate-50 px-3 py-2 text-[10px] font-extrabold text-slate-600">
              <span>الدورة</span><span>التكرار</span><span>الموعد</span>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-100 px-3 py-3 text-[11px] text-slate-700">
              <span className="font-bold">التحدي الأسبوعي</span><span>أسبوعياً</span><span>يُعلن داخل التطبيق</span>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-100 px-3 py-3 text-[11px] text-slate-700">
              <span className="font-bold">الختام الشهري</span><span>شهرياً</span><span>يُعلن داخل التطبيق</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            لا يوجد حالياً تقويم أو توقيت رسمي محدد في إعدادات المنصة؛ تعتمد المواعيد على الإعلان
            المنشور لكل دورة.
          </p>
        </CompetitionInfoCard>

        <button
          type="button"
          onClick={() => navigate('/competitions')}
          className="emerald-btn flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold"
        >
          <Trophy className="h-4 w-4" />
          استعراض المسابقات المتاحة
        </button>
      </div>
    </div>
  );
};
