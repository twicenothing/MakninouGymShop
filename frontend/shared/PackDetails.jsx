import { useI18n } from './i18n';
export function PackDetails({ pack }) {
  const { t, money } = useI18n();
  if (!pack?.packId) return null;
  return <div className="pack-details"><span className="pill">{t('Packs')}</span>
    {pack.originalPriceDZD > pack.packPriceDZD && <p><del>{money(pack.originalPriceDZD)}</del> <strong>{t('Save {0}', {0:money(pack.savingsDZD)})}</strong></p>}
    <ul>{pack.items.map(item => <li key={item.productId}>{item.quantity} × <bdi>{item.productName}</bdi></li>)}</ul>
  </div>;
}
