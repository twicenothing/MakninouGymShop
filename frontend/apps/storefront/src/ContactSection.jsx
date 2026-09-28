import { Instagram, Phone, MessageCircle, MapPin, ArrowUpRight } from 'lucide-react';
import { useI18n } from '../../../shared/i18n';
import './contacts.css';

const contacts = [
  { icon: Instagram, label: 'Instagram', detail: '@maknino_nutrition', href: 'https://www.instagram.com/maknino_nutrition/' },
  { icon: Phone, label: 'Call us', detail: '+213 562 60 66 09', href: 'tel:+213562606609' },
  { icon: MessageCircle, label: 'WhatsApp', detail: '+213 562 60 66 09', href: 'https://wa.me/213562606609' },
  { icon: MapPin, label: 'Find the store', detail: 'Ouled Yaïch, Blida', href: 'https://www.google.com/maps?q=FVW5+VXG+gym+Blida,+Ouled+Ya%C3%AFch&ftid=0x128f09720b6d3823:0x7e9cea4f013b6ded' }
];

export default function ContactSection() {
  const { t } = useI18n();
  return <section id="contact" className="contact-section page-width" aria-labelledby="contact-title">
    <div className="contact-heading"><span className="eyebrow">MAKNINOU / BLIDA</span><h2 id="contact-title">{t('Stay in touch')}</h2><p>{t('Contact the shop or come visit us.')}</p></div>
    <div className="contact-links">{contacts.map(({ icon: Icon, label, detail, href }) => <a key={label} href={href} {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <Icon size={23} aria-hidden="true"/><div><strong>{t(label)}</strong><bdi>{detail}</bdi></div><ArrowUpRight size={18} aria-hidden="true"/>
    </a>)}</div>
  </section>;
}
