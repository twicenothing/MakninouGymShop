import { LanguageProvider, LanguageSwitcher, useI18n } from '../../../shared/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Package, ShoppingBag, LogOut, Plus, Search, Pencil, Trash2, ArrowUpDown, RefreshCw, ShieldCheck, ArrowRight, LockKeyhole, X, CircleCheck, Clock3 } from 'lucide-react';
import { request, getProducts, categories, categoryName, categoryValue, mediaUrl, uploadProductImage } from '../../../shared/api';
import { Brand, Modal, Arrow, ErrorNotice, EmptyState } from '../../../shared/ui';
import '../../../shared/theme.css';
import Packs from './Packs';
import './admin.css';
import '../../../shared/languages.css';
import './product-images.css';

const blankProduct = { productName: '', category: 0, unitPrice: '', description: '', isWomenProduct: false };
const statusNames = ['Pending', 'InDelivery', 'Delivered', 'Cancelled'];
const orderStatus = value => typeof value === 'number' ? statusNames[value] || 'Unknown' : value || 'Unknown';
const prettyStatus = value => orderStatus(value) === 'InDelivery' ? 'In delivery' : orderStatus(value);

function App() {
  const { t, locale, money } = useI18n();
  const [session, setSession] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [page, setPage] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blankProduct);
  const [stock, setStock] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  useEffect(() => { setOrderError(''); setCancelConfirmation(false); }, [orderDetail?.id]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [notice, setNotice] = useState('');

  function signOut(message = '') { setSession(null); setProducts([]); setOrders([]); setEditor(null); setStock(null); setDeleting(null); setOrderDetail(null); setLoginError(message); }
  useEffect(() => {
    const expire = () => signOut('Your session expired. Please sign in again.');
    window.addEventListener('admin-session-expired', expire);
    return () => window.removeEventListener('admin-session-expired', expire);
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => signOut('Your session expired. Please sign in again.'), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); } }, [notice]);

  async function refresh() {
    if (!session || page === 'packs') return;
    setLoading(true); setError(''); setOrdersUnavailable(false);
    try {
      if (page === 'products') setProducts(await getProducts());
      else {
        const data = await request('/orders', { token: session.token });
        if (!Array.isArray(data)) throw new Error('Orders returned an unexpected response.');
        setOrders(data);
      }
    } catch (err) {
      if (page === 'orders' && [404,405].includes(err.status)) { setOrdersUnavailable(true); setOrders([]); }
      else setError(err.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [session, page]);

  async function login(event) {
    event.preventDefault(); if (loggingIn) return;
    const data = new FormData(event.currentTarget);
    setLoggingIn(true); setLoginError('');
    try {
      const result = await request('/admin/login', { method: 'POST', body: { username: data.get('username'), password: data.get('password') } });
      if (!result?.accessToken || !Number.isFinite(result.expiresIn)) throw new Error('The login response is incomplete.');
      setSession({ token: result.accessToken, username: data.get('username'), expiresAt: Date.now() + result.expiresIn * 1000 });
    } catch (err) { setLoginError(err.message); }
    finally { setLoggingIn(false); }
  }
  function navigate(next) { setPage(next); setSearch(''); setFilter('all'); setError(''); }
  function openEditor(product) {
    setEditor(product || 'new'); setFormError('');
    setImageFile(null); setRemoveImage(false);
    setForm(product ? { productName: product.productName, category: categoryValue(product.productCategory), unitPrice: product.productUnitPriceDZD, description: product.description, isWomenProduct: product.isWomenProduct } : { ...blankProduct });
  }
  async function saveProduct(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setFormError('');
    try {
      const saved = await request(editor === 'new' ? '/products' : `/products/${editor.id}`, {
        method: editor === 'new' ? 'POST' : 'PUT', token: session.token,
        body: { ...form, productName: form.productName.trim(), description: form.description.trim(), unitPrice: Number(form.unitPrice), category: Number(form.category) }
      });
      if (imageFile) await uploadProductImage(saved.id, imageFile, session.token);
      else if (removeImage && saved.imageUrl) await request(`/products/${saved.id}/image`, { method: 'DELETE', token: session.token });
      setNotice(editor === 'new' ? 'Product created.' : 'Product updated.'); setEditor(null); await refresh();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function adjustStock(event) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get('quantity')) * (data.get('direction') === 'decrease' ? -1 : 1);
    setBusy(true); setFormError('');
    try { await request(`/products/${stock.id}/stock`, { method: 'PATCH', token: session.token, body: { amount } }); setNotice('Stock updated.'); setStock(null); await refresh(); }
    catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function deleteProduct() {
    if (busy) return; setBusy(true); setFormError('');
    try { await request(`/products/${deleting.id}`, { method: 'DELETE', token: session.token }); setDeleting(null); setNotice('Product deleted.'); await refresh(); }
    catch (err) { setFormError(err.status === 500 ? 'This product could not be deleted. Products linked to existing orders must be kept.' : err.message); }
    finally { setBusy(false); }
  }
  async function changeOrderStatus(action) {
    if (orderBusy || !orderDetail) return;
    setOrderBusy(true); setOrderError('');
    try {
      const result = await request(`/orders/${orderDetail.id}/${action}`, { method: 'PATCH', token: session.token });
      if (result !== true) throw new Error('The order was not updated. Refresh and try again.');
      const status = { confirm: 1, cancel: 3, delivered: 2 }[action];
      setOrders(previous => previous.map(order => order.id === orderDetail.id ? { ...order, status } : order));
      setOrderDetail(previous => previous ? { ...previous, status } : null);
      setCancelConfirmation(false);
      setNotice(action === 'confirm' ? 'Order confirmed and in delivery.' : action === 'cancel' ? 'Order cancelled.' : 'Order marked as delivered.');
    } catch (err) { setOrderError(err.message); }
    finally { setOrderBusy(false); }
  }
  const filteredProducts = useMemo(() => products.filter(product => product.productName.toLowerCase().includes(search.toLowerCase())
    && (filter === 'all' || filter === 'low' && product.stockQuantity > 0 && product.stockQuantity <= 5 || filter === 'out' && product.stockQuantity === 0 || categoryName(product.productCategory) === filter)), [products, search, filter]);
  const filteredOrders = orders.filter(order => `${order.id} ${order.customerFullName} ${order.customerPhoneNumber}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || orderStatus(order.status) === filter));

  if (!session) return <main className="login-page"><section className="login-brand"><Brand/><div><span className="eyebrow light">{t("MAKNINOU / CONTROL ROOM")}</span><h1>{t("BEHIND")}<br/>{t("EVERY")}<br/><em>{t("STRONGER DAY.")}</em></h1><p>{t("Your products. Your stock. Your shop.")}</p></div><span className="login-footer">MAKNINOU NUTRITION © {new Date().getFullYear()}</span></section><section className="login-panel"><div className="login-form-wrap"><LanguageSwitcher/><div className="login-icon"><LockKeyhole size={25}/></div><span className="eyebrow">{t("ADMIN ACCESS")}</span><h2>{t("Welcome back.")}</h2><p className="muted">{t("Sign in to take care of your shop.")}</p><form onSubmit={login}><label>{t("Username")}<input name="username" autoComplete="username" required maxLength={256} placeholder={t("Your admin username")} disabled={loggingIn}/></label><label>{t("Password")}<input type="password" name="password" autoComplete="current-password" required maxLength={1024} placeholder={t("Your password")} disabled={loggingIn}/></label><ErrorNotice message={loginError}/><button className="button yellow full" disabled={loggingIn}>{loggingIn ? t("Signing in…") : t("Sign in")}<ArrowRight size={18}/></button></form><p className="login-note"><ShieldCheck size={16}/>{t("Private access for shop administrators")}</p></div></section></main>;

  return <div className="admin-layout"><aside className="admin-sidebar"><Brand/><span className="sidebar-caption">{t("SHOP MANAGEMENT")}</span><nav aria-label={t("Admin navigation")}><button className={page === 'products' ? 'selected' : ''} onClick={() => navigate('products')}><Package size={19}/>{t("Products")}<span>{products.length || '—'}</span></button><button className={page === 'orders' ? 'selected' : ''} onClick={() => navigate('orders')}><ShoppingBag size={19}/>{t("Orders")}<Arrow size={16}/></button><button className={page === "packs" ? "selected" : ""} onClick={() => navigate("packs")}><Package size={19}/>{t("Packs")}</button></nav><div className="sidebar-bottom"><span className="sidebar-stamp">{t("KEEP")}<br/>{t("BUILDING")}<span>MK.</span></span><div className="admin-account"><span className="avatar">{session.username.slice(0,1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{t("Administrator")}</small></div><button aria-label={t("Sign out")} className="icon-button" onClick={() => signOut()}><LogOut size={18}/></button></div></div></aside>
    <div className="admin-workspace"><header className="admin-topbar"><span>{t("Workspace")}<span>/</span> <b>{t(page === "products" ? "Products" : page === "packs" ? "Packs" : "Orders")}</b></span><LanguageSwitcher/></header>
      <main className="admin-content"><div className="admin-title"><div><span className="eyebrow">{page !== 'orders' ? t("YOUR INVENTORY, AT A GLANCE") : t("FROM YOUR SHOP TO THEIR DOOR")}</span><h1>{t(page === "products" ? "Products" : page === "packs" ? "Packs" : "Orders")}<span>.</span></h1><p className="muted">{page !== 'orders' ? t("Keep the essentials stocked and your collection up to date.") : t("Keep track of the people fueling their next with you.")}</p></div>{page !== 'packs' && <div className="title-actions"><button className="icon-button bordered" onClick={refresh} disabled={loading} aria-label={t("Refresh data")}><RefreshCw size={18} className={loading ? 'spinning' : ''}/></button>{page === 'products' && <button className="button yellow" onClick={() => openEditor(null)}><Plus size={18}/>{t("Add product")}</button>}</div>}</div>
      {page === 'products' && <section className="metrics" aria-label={t("Inventory summary")}><div><span>{t("Total products")}<Package size={18}/></span><strong>{loading && !products.length ? '—' : products.length}</strong><small>{t("Across your collection")}</small></div><div><span>{t("Units in stock")}<ArrowUpDown size={18}/></span><strong>{products.reduce((sum,p) => sum + p.stockQuantity, 0)}</strong><small>{t("Ready for the next order")}</small></div><div className="metric-yellow"><span>{t("Low stock")}<Clock3 size={18}/></span><strong>{products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 5).length}</strong><small>{t("5 units or fewer remaining")}</small></div><div><span>{t("Out of stock")}<Package size={18}/></span><strong>{products.filter(p => p.stockQuantity <= 0).length}</strong><small>{t("Time to restock")}</small></div></section>}
      <ErrorNotice message={error} retry={refresh}/>
      {page === 'packs' ? <Packs token={session.token}/> : page === 'orders' && ordersUnavailable ? <section className="orders-unavailable"><div className="unavailable-icon"><ShoppingBag size={34}/></div><span className="eyebrow">{t("ORDER MANAGEMENT")}</span><h2>{t("Your orders will live here.")}</h2><p>{t("The order list isn’t connected yet. Customer checkout is available, but viewing orders here needs the order-list endpoint.")}</p><button className="button dark" onClick={refresh}><RefreshCw size={16}/>{t("Check connection")}</button><div className="unavailable-footer"><ShieldCheck size={17}/>{t("This view is reserved for administrators.")}</div></section> : <section className="inventory-panel"><div className="table-toolbar"><h2>{page === 'products' ? t("Product collection") : t("All orders")} <span>{page === 'products' ? filteredProducts.length : filteredOrders.length}</span></h2><div><label className="search-field"><Search size={17}/><input aria-label={page === 'products' ? t("Search inventory") : t("Search orders")} value={search} onChange={event => setSearch(event.target.value)} placeholder={page === 'products' ? t("Search products…") : t("Name, phone or order number…")}/></label><select aria-label={t("Filter records")} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{page === 'products' ? t("All products") : t("All statuses")}</option>{(page === 'products' ? [...categories,'low','out'] : statusNames).map(value => <option key={value} value={value}>{value === 'low' ? t("Low stock") : value === 'out' ? t("Out of stock") : value === 'InDelivery' ? t("In delivery") : t(value)}</option>)}</select></div></div>
        {loading ? <div className="table-loading" role="status"><RefreshCw className="spinning"/>{page === 'products' ? t("Loading products…") : t("Loading orders…")}</div> : page === 'products' ? <>
          <div className="table-scroll"><table><thead><tr><th>{t("Product")}</th><th>{t("Category")}</th><th>{t("Price")}</th><th>{t("Stock")}</th><th>{t("Status")}</th><th className="align-right">{t("Actions")}</th></tr></thead><tbody>{filteredProducts.map(product => <tr key={product.id}><td><div className="table-product"><span className="table-monogram">MK</span><div><strong>{product.productName}</strong><small>#{String(product.id).padStart(4,'0')}{product.isWomenProduct ? t(" · For women") : ''}</small></div></div></td><td>{t(categoryName(product.productCategory))}</td><td className="price-cell">{money(product.productUnitPriceDZD)}</td><td><strong>{product.stockQuantity}</strong><span className="muted">{t("units")}</span></td><td><span className={`status ${product.stockQuantity <= 0 ? 'status-out' : product.stockQuantity <= 5 ? 'status-low' : 'status-active'}`}>{product.stockQuantity <= 0 ? t("Out of stock") : product.stockQuantity <= 5 ? t("Low stock") : t("In stock")}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={t("Edit {0}", { 0: product.productName })} onClick={() => openEditor(product)}><Pencil size={17}/></button><button className="icon-button" aria-label={t("Adjust stock for {0}", { 0: product.productName })} onClick={() => { setStock(product); setFormError(''); }}><ArrowUpDown size={17}/></button><button className="icon-button delete-action" aria-label={t("Delete {0}", { 0: product.productName })} onClick={() => { setDeleting(product); setFormError(''); }}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>
          {!filteredProducts.length && !error && <EmptyState icon={Package} title={products.length ? t("No products match.") : t("A fresh start for your collection.")}>{products.length ? t("Try another search or filter.") : t("Add your first product to get started.")}</EmptyState>}
        </> : <><div className="table-scroll"><table><thead><tr><th>{t("Order")}</th><th>{t("Customer")}</th><th>{t("Date")}</th><th>{t("Status")}</th><th>{t("Details")}</th></tr></thead><tbody>{filteredOrders.map(order => <tr key={order.id}><td><strong>#{order.id}</strong></td><td>{order.customerFullName}<small className="cell-subtitle">{order.customerPhoneNumber}</small></td><td>{new Date(order.createdAt).toLocaleDateString(locale)}</td><td><span className="status status-low">{t(prettyStatus(order.status))}</span></td><td><button className="text-button" onClick={() => setOrderDetail(order)}>{t("View order")}<Arrow size={16}/></button></td></tr>)}</tbody></table></div>{!filteredOrders.length && !error && <EmptyState icon={ShoppingBag} title={t("No orders to show.")}>{t("New orders will appear here when they’re placed.")}</EmptyState>}</>}
        <div className="table-footer"><span>{page === 'products' ? t("Prices shown in Algerian dinars (DZD)") : t("Newest orders can be reviewed here")}</span><span>MAKNINOU / ADMIN</span></div>
      </section>}
      </main><footer className="admin-footer">Makninou Nutrition <span>{t("Made for the everyday athlete.")}</span></footer>
    </div>
    {notice && <div className="toast" role="status"><CircleCheck size={18}/>{t(notice)}</div>}
    {editor && <Modal title={editor === 'new' ? t("Add a new essential.") : t("Edit product")} onClose={() => !busy && setEditor(null)}><form onSubmit={saveProduct} className="editor-form"><label>{t("Product name")}<input required maxLength={200} value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value })} disabled={busy}/></label><div className="form-grid"><label>{t("Category")}<select aria-label={t("Category")} value={form.category} onChange={event => setForm({ ...form, category: Number(event.target.value) })} disabled={busy}>{categories.map((category,index)=><option key={category} value={index}>{t(category)}</option>)}</select></label><label>{t("Unit price (DZD)")}<input type="number" required min="0" step="1" max="2147483647" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: event.target.value })} disabled={busy}/></label></div><label>{t("Product image")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setImageFile(event.target.files?.[0] || null); setRemoveImage(false); }} disabled={busy}/><small className="muted">{imageFile ? t('New image selected: {0}', {0:imageFile.name}) : t('Choose a JPG, PNG or WebP image (maximum 5 MB).')}</small></label>{editor !== 'new' && editor.imageUrl && <div className="image-editor-preview"><img src={mediaUrl(editor.imageUrl)} alt=""/><label className="check-field"><input type="checkbox" checked={removeImage} onChange={event => { setRemoveImage(event.target.checked); if(event.target.checked) setImageFile(null); }} disabled={busy}/>{t('Remove current image')}</label></div>}<label>{t("Description")}<textarea required rows={4} maxLength={3000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} disabled={busy}/></label><label className="check-field"><input type="checkbox" checked={form.isWomenProduct} onChange={event => setForm({ ...form, isWomenProduct: event.target.checked })} disabled={busy}/>{t("Include in the women’s collection")}</label>{editor === 'new' && <p className="muted small">{t("New products start with 1 unit. Use Adjust stock after creating the product.")}</p>}<ErrorNotice message={formError}/><div className="form-actions"><button type="button" className="button secondary" onClick={() => setEditor(null)} disabled={busy}>{t("Cancel")}</button><button className="button yellow" disabled={busy}>{busy ? t("Saving…") : editor === 'new' ? t("Create product") : t("Save changes")}<Arrow/></button></div></form></Modal>}
    {stock && <Modal title={t("Adjust stock")} onClose={() => !busy && setStock(null)}><p><strong>{stock.productName}</strong><br/><span className="muted">{t("Currently {0} units in stock", { 0: stock.stockQuantity })}</span></p><form onSubmit={adjustStock}><div className="form-grid"><label>{t("Action")}<select name="direction" disabled={busy}><option value="increase">{t("Increase stock")}</option><option value="decrease">{t("Decrease stock")}</option></select></label><label>{t("Number of units")}<input name="quantity" required type="number" defaultValue="1" min="1" max="2147483647" step="1" disabled={busy}/></label></div><ErrorNotice message={formError}/><button className="button yellow full" disabled={busy}>{busy ? t("Updating…") : t("Update stock")}<ArrowUpDown size={18}/></button></form></Modal>}
    {deleting && <Modal title={t("Delete this product?")} onClose={() => !busy && setDeleting(null)}><p><strong>{deleting.productName}</strong>{t("will be removed from the shop. This action cannot be undone.")}</p><p className="muted small">{t("Products linked to orders may be protected from deletion.")}</p><ErrorNotice message={formError}/><div className="form-actions"><button className="button secondary" onClick={() => setDeleting(null)} disabled={busy}>{t("Keep product")}</button><button className="button danger-button" onClick={deleteProduct} disabled={busy}>{busy ? t("Deleting…") : t("Delete product")}</button></div></Modal>}
    {orderDetail && <Modal title={t("Order #{0}", { 0: orderDetail.id })} onClose={() => !orderBusy && setOrderDetail(null)}><span className="pill" role="status">{t(prettyStatus(orderDetail.status))}</span><h3>{orderDetail.customerFullName}</h3><p>{orderDetail.customerPhoneNumber}<br/>{orderDetail.customerAdress}</p>{Array.isArray(orderDetail.items) ? <><div className="order-lines">{orderDetail.items.map((item,index) => <div key={index}><span>{item.itemName || t(item.packId != null ? "Pack #{0}" : "Product #{0}", { 0: item.packId ?? item.productId })} × {item.quantity}</span><strong>{money(item.unitPriceDZD * item.quantity)}</strong></div>)}</div><div className="cart-total"><span>{t("Products subtotal")}</span><strong>{money(orderDetail.items.reduce((sum,item) => sum + item.unitPriceDZD * item.quantity, 0))}</strong></div></> : <p className="muted">{t("Item details aren’t available in this order response yet.")}</p>}
      <ErrorNotice message={orderError}/>
      {cancelConfirmation ? <div className="order-actions"><p>{t("Cancel this order? Stock will not be restored automatically.")}</p><div className="form-actions"><button className="button secondary" disabled={orderBusy} onClick={() => setCancelConfirmation(false)}>{t("Keep order")}</button><button className="button danger-button" disabled={orderBusy} onClick={() => changeOrderStatus('cancel')}>{orderBusy ? t("Cancelling…") : t("Confirm cancellation")}</button></div></div> : <div className="form-actions">
        {['Pending', 'InDelivery'].includes(orderStatus(orderDetail.status)) && <button className="button secondary" disabled={orderBusy} onClick={() => setCancelConfirmation(true)}>{t("Cancel order")}</button>}
        {orderStatus(orderDetail.status) === 'Pending' && <button className="button yellow" disabled={orderBusy} onClick={() => changeOrderStatus('confirm')}>{orderBusy ? t("Updating…") : t("Confirm order")}</button>}
        {orderStatus(orderDetail.status) === 'InDelivery' && <button className="button yellow" disabled={orderBusy} onClick={() => changeOrderStatus('delivered')}>{orderBusy ? t("Updating…") : t("Mark as delivered")}</button>}
      </div>}
    </Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<LanguageProvider><App/></LanguageProvider>);
