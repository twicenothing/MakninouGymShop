import { LanguageProvider, LanguageSwitcher, useI18n } from '../../../shared/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Plus, Minus, Trash2, Check, ArrowRight, SlidersHorizontal, X, Package, Zap, Tag, Trophy } from 'lucide-react';
import { getProducts, getPacks, categories, request, categoryName } from '../../../shared/api';
import { packProduct, fitsStock, orderLines } from '../../../shared/catalog';
import { PackDetails } from '../../../shared/PackDetails';
import { Brand, Arrow, Modal, ErrorNotice, EmptyState } from '../../../shared/ui';
import '../../../shared/theme.css';
import ProductCard from './ProductCard';
import ProductRail from './ProductRail';
import ContactSection from './ContactSection';
import Venus from './WomenFitnessIcon';
import './store.css';
import './stock-bag.css';
import '../../../shared/languages.css';

const catalogCategories = ['All products', ...categories];
function loadCart() {
  try { const cart = JSON.parse(localStorage.getItem('makninou-cart') || '[]');
    return Array.isArray(cart) ? cart.filter(item => (Number.isInteger(item.id) && item.id > 0 || /^pack:[1-9]\d*$/.test(item.id)) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch { return []; }
}

function App() {
  const { t, locale, money } = useI18n();
  const [products, setProducts] = useState([]);
  const [bestSellerIds, setBestSellerIds] = useState([]);
  const [bestSellerError, setBestSellerError] = useState('');
  const [bestSellerLoading, setBestSellerLoading] = useState(true);
  async function loadBestSellers() {
    setBestSellerError(''); setBestSellerLoading(true);
    try {
      const ids = await request('/products/best-sellers');
      if (!Array.isArray(ids)) throw new Error('The catalog returned an unexpected response.');
      setBestSellerIds(ids);
    } catch (err) { setBestSellerError(err.message); }
    finally { setBestSellerLoading(false); }
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All products');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [inStock, setInStock] = useState(false);
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try {
      const [catalog, packs] = await Promise.all([getProducts(), getPacks()]);
      setProducts([...catalog, ...packs.map(pack => packProduct(pack, catalog))]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { loadBestSellers(); }, []);
  useEffect(() => { try { localStorage.setItem('makninou-cart', JSON.stringify(cart)); } catch { /* Cart remains usable in memory. */ } }, [cart]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); } }, [notice]);
  const filtered = useMemo(() => {
    const list = products.filter(product => !product.packId && (category === 'All products' || (category === 'For women' ? product.isWomenProduct : categoryName(product.productCategory) === category))
      && (!inStock || product.stockQuantity > 0) && `${product.productName} ${product.description}`.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a,b) => sort === 'low' ? a.productUnitPriceDZD - b.productUnitPriceDZD : sort === 'high' ? b.productUnitPriceDZD - a.productUnitPriceDZD : sort === 'name' ? a.productName.localeCompare(b.productName, locale) : (b.packId || b.id) - (a.packId || a.id));
  }, [products, category, search, sort, inStock, locale]);
  const cartItems = cart.map(item => ({ ...item, product: products.find(product => product.id === item.id) }));
  const total = cartItems.reduce((sum, item) => sum + (item.product?.productUnitPriceDZD || 0) * item.quantity, 0);
  const count = cart.reduce((sum,item) => sum + item.quantity, 0);
  const stockConflict = !fitsStock(cart, products);
  const invalidCart = !cart.length || loading || !!error || stockConflict;
  function add(product) {
    const current = cart.find(item => item.id === product.id)?.quantity || 0;
    const next = current ? cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...cart, { id: product.id, quantity: 1 }];
    if (!fitsStock(next, products)) { setNotice('Shared stock limit.'); return; }
    setCart(next);
    setNotice({ key: '{0} added to your bag', values: { 0: product.productName } });
  }
  function quantity(id, change) {
    setCart(previous => {
      const updated = previous.flatMap(item => {
      if (item.id !== id) return [item];
      const available = products.find(product => product.id === id)?.stockQuantity ?? 0;
      const next = Math.min(item.quantity + change, available);
      return next > 0 ? [{ ...item, quantity: next }] : [];
      });
      if (change > 0 && !fitsStock(updated, products)) return previous;
      return updated;
    });
  }
  async function placeOrder(event) {
    event.preventDefault(); if (invalidCart || submitting) return;
    const data = new FormData(event.currentTarget);
    setSubmitting(true); setOrderError('');
    try {
      const result = await request('/orders', { method: 'POST', body: {
        customerFullName: data.get('name').trim(), customerPhoneNumber: data.get('phone').trim(), customerAdress: data.get('address').trim(),
        items: orderLines(cart)
      } });
      setOrder(result); setCart([]); setCartOpen(false); setCheckout(false); refresh();
    } catch (err) { setOrderError(err.message); refresh(); }
    finally { setSubmitting(false); }
  }
  function chooseCategory(value) { setCategory(value); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); }
  return <>
    <div className="announcement"><Zap size={14}/><span>{t("BUILT FOR THE WORK. FUEL FOR WHAT’S NEXT.")}</span><span className="announcement-right">MAKNINOU NUTRITION / DZ</span></div>
    <header className="store-header"><a className="brand-link" href="#" aria-label={t("Makninou Nutrition home")}><Brand/></a>
      <nav aria-label={t("Main navigation")}><a href="#shop" className="active" onClick={() => setCategory('All products')}>{t("Shop all")}</a><a href="#deals">{t("Good deals")}</a><a href="#best-sellers">{t("Best sellers")}</a><a href="#women"><Venus size={17}/>{t("For women")}</a></nav>
      <LanguageSwitcher/><button className="bag-button" onClick={() => { setCartOpen(true); setCheckout(false); }} aria-label={t("Open shopping bag, {0} items", { 0: count })}><ShoppingBag size={20}/><span>{t("Bag")}</span><b>{count}</b></button>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow light"><span className="tiny-line"/>{t("THE EVERYDAY ATHLETE’S NUTRITION SHOP")}</span><h1>{t("PUT IN")}<br/>{t("THE WORK.")}<br/><em>{t("FUEL THE REST.")}</em></h1><p>{t("Your next rep. Your next goal. Find the supplements")}<br className="desktop-break"/>{t("and daily essentials that fit your routine.")}</p><a className="button yellow" href="#shop">{t("Find your fuel")}<ArrowRight size={19}/></a><div className="hero-index">01 / <span>{t("SHOW UP. GO AGAIN.")}</span></div></div>
        <div className="hero-brand" aria-hidden="true"><div className="brand-frame"><span className="frame-label">MAKNINOU / NUTRITION</span><img src="/logo.png" alt=""/><span className="frame-foot">{t("NO SHORTCUTS.")}<br/>{t("JUST YOUR NEXT LEVEL.")}</span><Arrow size={44}/></div><span className="vertical-word">{t("STAY HUNGRY. STAY CONSISTENT.")}</span></div>
      </section>
      <div className="category-strip"><span>{t("FIND YOUR FUEL")}</span><button onClick={() => chooseCategory('Proteine')}>{t("Proteine")}<Arrow/></button><button onClick={() => chooseCategory('Vitamin')}>{t("DAILY VITAMINS")}<Arrow/></button><button onClick={() => document.getElementById("women").scrollIntoView({behavior:"smooth"})}><Venus size={20}/>{t("For women")}<Arrow/></button></div>
      <section id="shop" className="catalog page-width">
        <div className="section-heading"><div><span className="eyebrow">{t("THE MAKNINOU SELECTION")}</span><h2>{t("YOUR GOALS.")}<br/><span>{t("YOUR ESSENTIALS.")}</span></h2></div><p>{t("Make every day count.")}<br/>{t("Build your routine, one essential at a time.")}</p></div>
        <div className="catalog-controls"><div className="category-carousel" aria-label={t("Product categories")}><div className="category-marquee"><div className="category-tabs">{catalogCategories.map(value => <button key={value} aria-pressed={category === value} className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{t(value)}</button>)}</div><div className="category-tabs" aria-hidden="true">{catalogCategories.map(value => <button key={value} tabIndex={-1} className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{t(value)}</button>)}</div></div></div>
          <label className="search-field"><Search size={18}/><input aria-label={t("Search products")} placeholder={t("Search your essentials")} value={search} onChange={event => setSearch(event.target.value)}/>{search && <button aria-label={t("Clear search")} onClick={() => setSearch('')}><X size={16}/></button>}</label></div>
        <div className="result-controls"><span>{loading ? t("Loading the collection…") : t("{0} products", { 0: filtered.length })}</span><div><label className="check-field"><input type="checkbox" checked={inStock} onChange={event => setInStock(event.target.checked)}/>{t("In stock only")}</label><label className="sort-field"><SlidersHorizontal size={15}/><select aria-label={t("Sort products")} value={sort} onChange={event => setSort(event.target.value)}><option value="featured">{t("Newest arrivals")}</option><option value="low">{t("Price: low to high")}</option><option value="high">{t("Price: high to low")}</option><option value="name">{t("Name: A to Z")}</option></select></label></div></div>
        <ErrorNotice message={error} retry={refresh}/>
        {loading ? <ProductRail label={t("Loading products")}>{[1,2,3,4].map(id => <div key={id} className="product-skeleton"/>)}</ProductRail> : !error && <ProductRail label={t("Products")}>{filtered.map(product => <ProductCard key={product.id} product={product} onAdd={add} onDetail={setDetail}/>)}</ProductRail>}
        {!loading && !error && !filtered.length && <EmptyState icon={Package} title={t("Nothing here just yet.")} action={<button className="button dark" onClick={() => { setSearch(''); setCategory('All products'); setInStock(false); }}>{t("Reset filters")}</button>}>{t("Try another category or search term.")}</EmptyState>}
      </section>
      <section id="deals" className="collection-section deals-section page-width" aria-labelledby="deals-title">
        <div className="collection-heading"><span className="collection-icon"><Tag size={30}/></span><div><span className="eyebrow">{t('Better together')}</span><h2 id="deals-title">{t('Good deals')}</h2><p>{t('Pack section description')}</p></div></div>
        {loading ? <p role="status">{t('Loading the collection…')}</p> : error ? <ErrorNotice message={error} retry={refresh}/> : products.some(p=>p.packId) ? <ProductRail label={t('Good deals')}>{products.filter(p=>p.packId).map(product=><ProductCard key={product.id} product={product} onAdd={add} onDetail={setDetail}/>)}</ProductRail> : <p className="collection-empty">{t('Deals coming soon')}</p>}
      </section>
      <section id="best-sellers" className="collection-section page-width" aria-labelledby="best-sellers-title">
        <div className="collection-heading"><span className="collection-icon"><Trophy size={30}/></span><div><span className="eyebrow">{t('Customer favourites')}</span><h2 id="best-sellers-title">{t('Best sellers')}</h2><p>{t('Best sellers description')}</p></div></div>
        {loading || bestSellerLoading ? <p role="status">{t('Loading the collection…')}</p> : error || bestSellerError ? <ErrorNotice message={error || bestSellerError} retry={()=>{refresh();loadBestSellers();}}/> : bestSellerIds.some(id=>products.some(p=>p.id===id)) ? <ProductRail label={t('Best sellers')}>{bestSellerIds.map(id=>products.find(p=>p.id===id)).filter(Boolean).map(product=><ProductCard key={product.id} product={product} onAdd={add} onDetail={setDetail}/>)}</ProductRail> : <p className="collection-empty">{t('Best sellers coming soon')}</p>}
      </section>
      <section id="women" className="collection-section women-section page-width" aria-labelledby="women-title">
        <div className="collection-heading"><span className="collection-icon women-icon"><Venus size={36}/></span><div><span className="eyebrow">{t('Your own rhythm')}</span><h2 id="women-title">{t('For women')}</h2><p>{t('Women section description')}</p></div></div>
        {loading ? <p role="status">{t('Loading the collection…')}</p> : error ? <ErrorNotice message={error} retry={refresh}/> : products.some(p=>p.isWomenProduct) ? <ProductRail label={t('For women')}>{products.filter(p=>p.isWomenProduct&&!p.packId).map(product=><ProductCard key={product.id} product={product} onAdd={add} onDetail={setDetail}/>)}</ProductRail> : <p className="collection-empty">{t('Women collection coming soon')}</p>}
      </section>
      <section className="statement page-width"><span className="eyebrow">{t("YOUR ROUTINE. YOUR PACE.")}</span><h2>{t("CONSISTENCY")}<br/>{t("LOOKS GOOD ON YOU.")}</h2><a href="#shop">{t("Keep building")}<Arrow size={22}/></a><span className="statement-mark" aria-hidden="true">MK.</span></section>
      <ContactSection/>
    </main>
    <footer className="store-footer page-width"><Brand/><span>{t("FUEL YOUR NEXT.")}</span><p>© {new Date().getFullYear()} Makninou Nutrition</p><a href="#shop">{t("Back to the shop")}<Arrow/></a></footer>
    {!cartOpen && !detail && !order && <button className="floating-bag" onClick={() => { setCartOpen(true); setCheckout(false); }} aria-label={t("View bag, {0} items", { 0: count })}><ShoppingBag size={24}/><span>{t("Bag")}</span><b>{count}</b></button>}
    {notice && <div className="toast" role="status"><Check size={18}/>{t(notice)}</div>}
    {detail && <Modal title={detail.productName} onClose={() => setDetail(null)}><span className="pill">{t(categoryName(detail.productCategory))}</span><p className="detail-description">{detail.description}</p><PackDetails pack={detail}/><div className="detail-price">{money(detail.productUnitPriceDZD)}</div><p className="muted">{detail.stockQuantity > 0 ? t("{0} available", { 0: detail.stockQuantity }) : t("Currently sold out")}</p><button className="button yellow full" disabled={detail.stockQuantity <= 0} onClick={() => add(detail)}>{t("Add to bag")}<Plus size={18}/></button></Modal>}
    {cartOpen && <Modal title={checkout ? t("Make it yours.") : t("Your bag ({0})", { 0: count })} onClose={() => { if (!submitting) setCartOpen(false); }} wide>
      {!cart.length ? <EmptyState icon={ShoppingBag} title={t("Your next routine starts here.")} action={<button className="button yellow" onClick={() => setCartOpen(false)}>{t("Explore the collection")}<Arrow/></button>}>{t("Add a few essentials to your bag.")}</EmptyState> : <>
        <div className="cart-items">{cartItems.map(item => <div className="cart-item" key={item.id}><div className="cart-monogram">MK</div><div className="cart-item-name"><strong>{item.product?.productName || t("Product no longer available")}</strong><small>{item.product ? money(item.product.productUnitPriceDZD) : t("Remove this item to continue")}</small>{item.product && item.quantity > item.product.stockQuantity && <small className="danger">{t("Only {0} remaining. Adjust quantity.", { 0: item.product.stockQuantity })}</small>}</div><div className="quantity-control"><button aria-label={t("Decrease {0}", { 0: item.product?.productName || t('quantity') })} onClick={() => quantity(item.id, -1)} disabled={submitting}><Minus size={14}/></button><span>{item.quantity}</span><button aria-label={t("Increase {0}", { 0: item.product?.productName || t('quantity') })} onClick={() => quantity(item.id, 1)} disabled={submitting || !fitsStock(cart.map(line => line.id === item.id ? {...line, quantity: line.quantity + 1} : line), products)}><Plus size={14}/></button></div><button className="icon-button" aria-label={t("Remove {0}", { 0: item.product?.productName || t('item') })} disabled={submitting} onClick={() => setCart(previous => previous.filter(entry => entry.id !== item.id))}><Trash2 size={17}/></button></div>)}</div>
        <div className="cart-total"><span>{t("Products subtotal")}</span><strong>{money(total)}</strong></div><p className="muted small">{t("Delivery and payment arrangements are confirmed by the shop. No online payment is collected here.")}</p>
        {error && <ErrorNotice message={error} retry={refresh}/>} {!loading && !error && stockConflict && <ErrorNotice message="Shared stock limit."/>}
        {checkout ? <form className="checkout-form" onSubmit={placeOrder}><h3>{t("Where should your order go?")}</h3><div className="form-grid"><label>{t("Full name")}<input required name="name" autoComplete="name" maxLength={150} disabled={submitting}/></label><label>{t("Phone number")}<input required type="tel" name="phone" autoComplete="tel" placeholder="+213" maxLength={30} disabled={submitting}/></label></div><label>{t("Delivery address")}<textarea required name="address" autoComplete="street-address" rows={3} maxLength={600} disabled={submitting}/></label><ErrorNotice message={orderError}/><button className="button yellow full" disabled={submitting || invalidCart}>{submitting ? t("Placing your order…") : t("Place order")}<ArrowRight size={19}/></button></form> : <button className="button yellow full" disabled={invalidCart} onClick={() => { setCheckout(true); setOrderError(''); }}>{t("Continue to checkout")}<ArrowRight size={19}/></button>}
      </>}
    </Modal>}
    {order && <Modal title={t("You’re on your way.")} onClose={() => setOrder(null)}><div className="success-mark"><Check size={36}/></div><h3>{t("Order #{0} received", { 0: order.id })}</h3><p>{t("Thanks, {0}. Your order has been saved. The shop will use your contact details to arrange the next steps.", { 0: order.customerFullName })}</p><button className="button yellow full" onClick={() => setOrder(null)}>{t("Back to the collection")}<Arrow/></button></Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<LanguageProvider><App/></LanguageProvider>);

import './collections.css';
import './horizontal-products.css';
