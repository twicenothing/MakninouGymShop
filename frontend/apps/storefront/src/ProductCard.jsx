import { Plus } from 'lucide-react';
import { categoryName, mediaUrl } from '../../../shared/api';
import { useI18n } from '../../../shared/i18n';
import { PackDetails } from '../../../shared/PackDetails';
import { Arrow } from '../../../shared/ui';
export default function ProductCard({ product, onAdd, onDetail }) {
  const { t, money } = useI18n();
  return <article className={`product-card${product.stockQuantity <= 0 ? ' is-sold-out' : ''}`} key={product.id}>
          <button className={`product-art category-${product.packId ? "packs" : categoryName(product.productCategory) === "Vitamin" ? "vitamins" : "supplements"}${product.imageUrl ? ' has-image' : ''}`} onClick={() => onDetail(product)} aria-label={t("View {0}", { 0: product.productName })}>{product.imageUrl ? <img src={mediaUrl(product.imageUrl)} alt="" loading="lazy"/> : <><span className="art-top"><span>{t(categoryName(product.productCategory))}</span><Arrow/></span><span className="art-type">{categoryName(product.productCategory) === 'Vitamin' ? t("DAILY") : t("FUEL")}<span>{categoryName(product.productCategory) === 'Vitamin' ? t("ESSENTIALS") : t("YOUR NEXT")}</span></span><span className="art-bottom">MK / NUTRITION <span>{String(product.id).padStart(3, '0')}</span></span></>}{product.stockQuantity <= 0 && <span className="sold-out-banner">{t("SOLD OUT")}</span>}</button>
          <div className="product-info"><div className="product-meta"><span>{product.isWomenProduct ? t("FOR WOMEN") : t(categoryName(product.productCategory))}</span><span className={product.stockQuantity > 0 ? 'stock-label' : 'sold-out'}>{product.stockQuantity > 0 ? t("In stock") : t("Sold out")}</span></div><button className="product-name" onClick={() => onDetail(product)}>{product.productName}</button><p>{product.description}</p><PackDetails pack={product}/><div className="product-bottom"><strong>{money(product.productUnitPriceDZD)}</strong><button className="add-button" onClick={() => onAdd(product)} disabled={product.stockQuantity <= 0} aria-label={t("Add {0} to bag", { 0: product.productName })}><Plus size={19}/></button></div></div>
        </article>;
}
