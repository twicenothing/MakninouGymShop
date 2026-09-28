import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Package } from 'lucide-react';
import { getPacks, getProducts, request } from '../../../shared/api';
import { useI18n } from '../../../shared/i18n';
import { Modal, ErrorNotice, EmptyState } from '../../../shared/ui';

const blank = () => ({packName:'', description:'', packPriceDZD:'', items:[{productId:'',quantity:1}]});
export default function Packs({ token }) {
  const { t, money } = useI18n();
  const [packs,setPacks] = useState([]);
  const [products,setProducts] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [editor,setEditor] = useState(null);
  const [form,setForm] = useState(blank);
  const [deleting,setDeleting] = useState(null);
  const [busy,setBusy] = useState(false);
  const [formError,setFormError] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try { const [p,c] = await Promise.all([getPacks(token),getProducts()]); setPacks(p);setProducts(c); }
    catch(err) {setError(err.message);} finally {setLoading(false);}
  }
  useEffect(()=>{refresh();},[token]);
  function edit(pack) {
    setEditor(pack || 'new');setFormError('');
    setForm(pack ? {...pack,items:pack.items.map(i=>({productId:i.productId,quantity:i.quantity}))} : blank());
  }
  function item(index, field, value) {setForm(previous=>({...previous,items:previous.items.map((i,n)=>n===index ? {...i,[field]:value}:i)}));}
  async function save(event) {
    event.preventDefault(); if(busy) return;
    setBusy(true);setFormError('');
    try {
      await request(editor==='new'?'/packs':`/packs/${editor.id}`,{token,method:editor==='new'?'POST':'PUT',body:{
        packName:form.packName.trim(),description:form.description.trim(),packPriceDZD:Number(form.packPriceDZD),
        items:form.items.map(i=>({productId:Number(i.productId),quantity:Number(i.quantity)}))
      }});
      setEditor(null);await refresh();
    } catch(err){setFormError(err.message);} finally{setBusy(false);}
  }
  async function active(pack) {
    if(busy) return; setBusy(true);setError('');setFormError('');
    try {await request(`/packs/${pack.id}/active?isActive=${!pack.isActive}`,{token,method:'PATCH'});setDeleting(null);await refresh();}
    catch(err){deleting?setFormError(err.message):setError(err.message);} finally{setBusy(false);}
  }
  async function remove() {
    if(busy) return;setBusy(true);setFormError('');
    try{await request(`/packs/${deleting.id}`,{token,method:'DELETE'});setDeleting(null);await refresh();}
    catch(err){setFormError(err.message);}finally{setBusy(false);}
  }
  const original = form.items.reduce((sum,i)=>sum+(products.find(p=>p.id===Number(i.productId))?.productUnitPriceDZD||0)*Number(i.quantity),0);
  return <section className="inventory-panel pack-panel">
    <div className="table-toolbar"><h2>{t('Packs')}</h2><div><button className="icon-button" aria-label={t('Refresh data')} onClick={refresh} disabled={busy||loading}><RefreshCw size={18}/></button><button className="button yellow" onClick={()=>edit(null)} disabled={loading}><Plus size={18}/>{t('Create pack')}</button></div></div>
    <ErrorNotice message={error} retry={refresh}/>
    {loading ? <p className="table-loading">{t('Loading the collection…')}</p> : <div className="table-scroll"><table><thead><tr>{['Pack name','Contents','Price','Status','Actions'].map(key=><th key={key}>{t(key)}</th>)}</tr></thead><tbody>{packs.map(pack=><tr key={pack.id}>
      <td><strong>{pack.packName}</strong><small className="cell-subtitle">{pack.description}</small></td><td>{pack.items.map(i=><div key={i.productId}>{i.quantity} × <bdi>{i.productName}</bdi></div>)}</td><td>{money(pack.packPriceDZD)}</td><td><span className={`status ${pack.isActive?'status-active':'status-out'}`}>{t(pack.isActive?'Active':'Inactive')}</span></td>
      <td><div className="row-actions"><button className="icon-button" aria-label={t('Edit {0}',{0:pack.packName})} onClick={()=>edit(pack)} disabled={busy}><Pencil size={17}/></button><button className="text-button" onClick={()=>active(pack)} disabled={busy}>{t(pack.isActive?'Deactivate':'Activate')}</button><button className="icon-button" aria-label={t('Delete {0}',{0:pack.packName})} onClick={()=>{setDeleting(pack);setFormError('');}} disabled={busy}><Trash2 size={17}/></button></div></td>
    </tr>)}</tbody></table></div>}
    {!loading&&!packs.length&&!error&&<EmptyState icon={Package} title={t('No packs yet.')}>{t('Create your first pack.')}</EmptyState>}
    {editor&&<Modal title={t(editor==='new'?'Create pack':'Edit pack')} wide onClose={()=>!busy&&setEditor(null)}><form onSubmit={save}>
      <label>{t('Pack name')}<input required maxLength={200} value={form.packName} onChange={e=>setForm({...form,packName:e.target.value})} disabled={busy}/></label>
      <label>{t('Description')}<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} maxLength={3000} disabled={busy}/></label>
      <label>{t('Pack price')}<input type="number" min="1" max="2147483647" step="1" required value={form.packPriceDZD} onChange={e=>setForm({...form,packPriceDZD:e.target.value})} disabled={busy}/></label>
      <h3>{t('Contents')}</h3>
      {form.items.map((i,index)=><div className="pack-item-editor" key={index}><label>{t('Product')}<select aria-label={t('Component {0}',{0:index+1})} required value={i.productId} onChange={e=>item(index,'productId',e.target.value)} disabled={busy}><option value="">{t('Choose product')}</option>{products.map(p=><option key={p.id} value={p.id} disabled={form.items.some((other,n)=>n!==index&&Number(other.productId)===p.id)}>{p.productName}</option>)}</select></label><label>{t('Number of units')}<input aria-label={t('Quantity {0}',{0:index+1})} type="number" min="1" max="2147483647" step="1" required value={i.quantity} onChange={e=>item(index,'quantity',e.target.value)} disabled={busy}/></label><button type="button" className="icon-button" aria-label={t('Remove component {0}',{0:index+1})} disabled={busy||form.items.length===1} onClick={()=>setForm({...form,items:form.items.filter((_,n)=>n!==index)})}><Trash2 size={17}/></button></div>)}
      <button type="button" className="text-button" onClick={()=>setForm({...form,items:[...form.items,{productId:'',quantity:1}]})} disabled={busy||form.items.length>=products.length}><Plus size={17}/>{t('Add component')}</button>
      <p className="muted">{t('Separate price {0}',{0:money(original)})}</p><ErrorNotice message={formError}/><div className="form-actions"><button type="button" className="button secondary" onClick={()=>setEditor(null)} disabled={busy}>{t('Cancel')}</button><button className="button yellow" disabled={busy||!products.length}>{t(busy?'Saving…':'Save pack')}</button></div>
    </form></Modal>}
    {deleting&&<Modal title={t('Delete pack?')} onClose={()=>!busy&&setDeleting(null)}><p>{deleting.packName}</p><p>{t('Pack deletion warning')}</p><ErrorNotice message={formError}/><div className="form-actions"><button className="button secondary" onClick={()=>setDeleting(null)} disabled={busy}>{t('Cancel')}</button>{deleting.isActive&&<button className="button secondary" disabled={busy} onClick={()=>active(deleting)}>{t('Deactivate')}</button>}<button className="button danger-button" onClick={remove} disabled={busy}>{t('Delete pack')}</button></div></Modal>}
  </section>;
}
