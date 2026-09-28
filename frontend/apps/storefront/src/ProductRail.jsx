import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../../shared/i18n';

export default function ProductRail({ children, label }) {
  const { t } = useI18n();
  const rail = useRef(null);
  const move = direction => {
    const element = rail.current;
    if (!element) return;
    const amount = Math.max(260, element.clientWidth * 0.82);
    element.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return <div className="product-rail">
    <div ref={rail} className="product-grid" aria-label={label}>{children}</div>
    <div className="product-rail-controls">
      <button type="button" onClick={() => move(-1)} aria-label={t('Scroll products left')}><ChevronLeft size={20}/></button>
      <button type="button" onClick={() => move(1)} aria-label={t('Scroll products right')}><ChevronRight size={20}/></button>
    </div>
  </div>;
}
