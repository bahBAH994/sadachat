import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'full'
            ? 'gold-btn flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm whitespace-nowrap shrink-0 cursor-pointer'
            : 'royal-capsule flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[#F3D37A] hover:border-[#D4AF37]/70 transition cursor-pointer whitespace-nowrap shrink-0 min-h-[36px]'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{variant === 'full' ? 'تثبيت تطبيق صَدَى على جهازك' : 'تثبيت'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="royal-glass w-full max-w-sm rounded-3xl p-6 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#F3D37A]">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-lg font-bold">تثبيت تطبيق صَدَى</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isIOS ? (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>1. اضغط على زر <strong className="text-[#F3D37A]">المشاركة</strong> أسفل متصفح Safari.</p>
                <p>2. مرر للأسفل واختر <strong className="text-[#F3D37A]">إضافة إلى الشاشة الرئيسية</strong>.</p>
                <p>3. افتح صَدَى من أيقونة القصر الذهبية كتطبيق مستقل.</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>لتثبيت تطبيق <strong className="text-[#F3D37A]">صَدَى - SADA</strong> كتطبيق ويب تقدمي (PWA):</p>
                <p>1. افتح قائمة المتصفح أو اضغط على أيقونة التثبيت في شريط العنوان.</p>
                <p>2. اختر <strong className="text-[#F3D37A]">تثبيت التطبيق</strong> للوصول الفوري بملء الشاشة.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="gold-btn mt-5 w-full rounded-xl py-2.5 text-sm cursor-pointer"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 royal-capsule flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-amber-300 border-amber-400/50">
      <WifiOff className="w-3.5 h-3.5" />
      <span>وضع عدم الاتصال — يتم عرض البيانات المحفوظة</span>
    </div>
  );
};
