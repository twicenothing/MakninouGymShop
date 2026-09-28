import { useI18n } from './i18n';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, X, AlertCircle, RefreshCw } from 'lucide-react';

export function Brand({ compact = false }) {
  const { t } = useI18n();
  return <span className="brand"><img src="/logo.png" alt={t("Makninou Nutrition logo")} width="46" height="49"/>{!compact && <span>MAKNINOU<small>NUTRITION</small></span>}</span>;
}
export function Arrow({ size = 18 }) { return <ArrowUpRight size={size} aria-hidden="true"/>; }
export function ErrorNotice({ message, retry }) {
  const { t } = useI18n();
  if (!message) return null;
  return <div className="error-notice" role="alert"><AlertCircle size={20}/><span>{t(message)}</span>{retry && <button className="text-button" onClick={retry}><RefreshCw size={16}/>{t("Try again")}</button>}</div>;
}
export function Modal({ title, children, onClose, wide = false }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label={t("Close dialog")} onClick={onClose}><X/></button></div>
    {children}
  </dialog>;
}
export function EmptyState({ icon: Icon, title, children, action }) {
  return <div className="empty-state">{Icon && <Icon size={38} strokeWidth={1.3}/>}<h3>{title}</h3><p>{children}</p>{action}</div>;
}
