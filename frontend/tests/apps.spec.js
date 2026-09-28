import { test, expect } from '@playwright/test';

const fixtures = [
  { id: 1, productName: 'Whey Protein · Chocolate', description: 'Your post-training protein essential. Chocolate flavour, 1 kg.', productCategory: 0, productUnitPriceDZD: 8500, stockQuantity: 12, isWomenProduct: false },
  { id: 2, productName: 'Creatine Monohydrate', description: 'A straightforward addition to your training routine. 300 g.', productCategory: 0, productUnitPriceDZD: 4200, stockQuantity: 3, isWomenProduct: false },
  { id: 3, productName: 'Vitamin C 1000 mg', description: 'Make room for your daily essentials. 30 tablets.', productCategory: 4, productUnitPriceDZD: 1500, stockQuantity: 20, isWomenProduct: false },
  { id: 4, productName: 'Daily Multivitamin', description: 'Daily nutrition, made simple. 60 capsules.', productCategory: 4, productUnitPriceDZD: 2900, stockQuantity: 8, isWomenProduct: true },
  { id: 5, productName: 'Omega 3', description: 'An everyday essential for your collection. 60 softgels.', productCategory: 0, productUnitPriceDZD: 3200, stockQuantity: 0, isWomenProduct: false },
  { id: 6, productName: 'Magnesium Complex', description: 'Your daily routine starts with the essentials. 60 capsules.', productCategory: 4, productUnitPriceDZD: 2600, stockQuantity: 5, isWomenProduct: false },
  { id: 7, productName: 'Whey Isolate · Vanilla', description: 'A vanilla protein essential for your routine. 900 g.', productCategory: 0, productUnitPriceDZD: 11200, stockQuantity: 10, isWomenProduct: false },
  { id: 8, productName: 'Vitamin D3', description: 'A daily vitamin essential. 60 capsules.', productCategory: 4, productUnitPriceDZD: 1800, stockQuantity: 9, isWomenProduct: false }
];
async function mockApi(page, { orders = false, unavailable = false, packs = false } = {}) {
  let products = structuredClone(fixtures);
  let bundles = packs ? [{id:1,packName:'Starter Pack',description:'Protein and vitamins',packPriceDZD:9000,originalPriceDZD:10000,savingsDZD:1000,isActive:true,items:[{productId:1,productName:fixtures[0].productName,quantity:1,productUnitPriceDZD:8500},{productId:3,productName:fixtures[2].productName,quantity:1,productUnitPriceDZD:1500}]}] : [];
  const calls = [];
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname.replace('/api','');
    const method = req.method(); let data = null;
    if (['POST','PUT','PATCH'].includes(method)) data = req.postDataJSON();
    calls.push({ path, method, data, authorization: req.headers().authorization });
    const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (unavailable) return respond({ error: 'The shop is temporarily unavailable.' }, 503);
    if (path === '/admin/login') return data.password === 'wrong' ? respond(null, 401) : respond({ accessToken: 'test-token', expiresIn: 3600, tokenType: 'Bearer' });
    if (path === '/products/best-sellers') return respond([]);
    if (path === '/products' && method === 'GET') return respond(products);
    if (path === '/packs/all' && method === 'GET') return req.headers().authorization ? respond(bundles) : respond(null,401);
    if (path === '/packs' && method === 'GET') return respond(bundles.filter(p=>p.isActive));
    if (path.startsWith('/packs') && method !== 'GET') {
      if (!req.headers().authorization) return respond(null,401);
      const id=Number(path.split('/')[2]);
      if(method==='PATCH'){bundles.find(p=>p.id===id).isActive=url.searchParams.get('isActive')==='true';return respond(null);}
      if(method==='DELETE') {
        if(id===1) return respond({error:'This pack has been used in orders and cannot be deleted. Deactivate it instead.'},409);
        bundles=bundles.filter(p=>p.id!==id);return respond(null);
      }
      const items=data.items.map(i=>({...i,productName:products.find(p=>p.id===i.productId).productName,productUnitPriceDZD:products.find(p=>p.id===i.productId).productUnitPriceDZD}));
      const original=items.reduce((sum,i)=>sum+i.quantity*i.productUnitPriceDZD,0);
      const result={...data,id:method==='POST'?2:id,items,isActive:method==='POST'?true:bundles.find(p=>p.id===id).isActive,originalPriceDZD:original,savingsDZD:original-data.packPriceDZD};
      bundles=method==='POST'?[...bundles,result]:bundles.map(p=>p.id===id?result:p);return respond(result);
    }
    if (path === '/orders' && method === 'POST') return respond({ id: 24, ...data }, 201);
    if (path.startsWith('/orders/') && method === 'PATCH') return req.headers().authorization ? respond(true) : respond(null, 401);
    if (path === '/orders' && method === 'GET') return orders ? respond([{ id: 24, createdAt: '2026-09-27T10:00:00Z', status: 0, customerFullName: 'Test Customer', customerPhoneNumber: '0555000000', customerAdress: 'Test address', items: [{ productId: 1, itemName: fixtures[0].productName, packId: null, quantity: 2, unitPriceDZD: 8500 }] }]) : respond(null, 405);
    if (!req.headers().authorization) return respond(null, 401);
    if (path === '/products' && method === 'POST') {
      const product = { id: 9, ...data, productCategory: data.category, productUnitPriceDZD: data.unitPrice, stockQuantity: 1 };
      products.push(product); return respond(product);
    }
    const id = Number(path.split('/')[2]); const product = products.find(p => p.id === id);
    if (method === 'PUT') { Object.assign(product, data, { productCategory: data.category, productUnitPriceDZD: data.unitPrice }); return respond(product); }
    if (method === 'PATCH') { product.stockQuantity += data.amount; return respond(product); }
    if (method === 'DELETE') { products = products.filter(p => p.id !== id); return respond(null); }
    return respond(null,404);
  });
  return calls;
}
async function login(page) {
  await page.goto('http://127.0.0.1:5174');
  await page.getByLabel("Identifiant", { exact: true }).fill('admin');
  await page.getByLabel("Mot de passe", { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Produits.', exact: true })).toBeVisible();
}
test('storefront filtering, bag and real-shaped checkout', async ({ page }) => {
  const calls = await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText("8 produits", { exact: true })).toBeVisible();
  const productRail = page.locator('#shop .product-grid');
  await expect(productRail).toHaveCSS('display', 'flex');
  await expect(productRail).toHaveCSS('overflow-x', 'auto');
  await page.screenshot({ path: 'test-results/storefront-desktop.png', fullPage: true });
  await page.getByLabel("Rechercher des produits").fill('Vitamin C');
  await expect(page.locator('#shop .product-card')).toHaveCount(1);
  await page.getByRole('button', { name: "Ajouter Vitamin C 1000 mg au panier" }).click();
  await page.getByRole('button', { name: "Ouvrir le panier, 1 article(s)" }).click();
  await page.getByRole('button', { name: "Finaliser la commande" }).click();
  await page.getByLabel("Nom complet").fill('Test Customer');
  await page.getByLabel("Numéro de téléphone").fill('0555000000');
  await page.getByLabel("Adresse de livraison").fill('Test address');
  await page.getByRole('button', { name: "Passer commande", exact: true }).click();
  await expect(page.getByRole('heading', { name: "Commande n°24 reçue" })).toBeVisible();
  expect(calls.find(c => c.path === '/orders' && c.method === 'POST').data).toEqual({ customerFullName: 'Test Customer', customerPhoneNumber: '0555000000', customerAdress: 'Test address', items: [{ productId: 3, quantity: 1 }] });
});
test('mobile layout and catalog connection failure', async ({ page }) => {
  await mockApi(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173'); await expect(page.locator('#shop .product-card')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/storefront-mobile.png', fullPage: true });
  await page.getByRole('link', { name: "Pour femmes", exact: true }).click();
  await expect(page.locator('#women .product-card')).toHaveCount(1);
});
test('admin product creation, edit, stock and delete use JWT', async ({ page }) => {
  const calls = await mockApi(page); await page.setViewportSize({ width: 1440, height: 1000 }); await login(page);
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.getByRole('button', { name: "Ajouter un produit", exact: true }).click();
  await page.getByLabel("Nom du produit", { exact: true }).fill('Test Essential');
  await page.getByLabel("Prix unitaire (DZD)").fill('2200');
  await page.getByLabel("Description", { exact: true }).fill('An integration test product.');
  await page.getByRole('button', { name: "Créer le produit", exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(9);
  await page.getByRole('button', { name: "Modifier Test Essential", exact: true }).click();
  await page.getByLabel("Prix unitaire (DZD)").fill('2300');
  await page.getByRole('button', { name: "Enregistrer les modifications", exact: true }).click();
  await expect(page.getByText(new Intl.NumberFormat('fr-DZ', {style:'currency', currency:'DZD', maximumFractionDigits:0}).format(2300), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: "Ajuster le stock de Test Essential", exact: true }).click();
  await page.getByLabel("Nombre d’unités").fill('5');
  await page.getByRole('button', { name: "Mettre à jour le stock", exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: "Supprimer Test Essential", exact: true }).click();
  await page.getByRole('button', { name: "Supprimer le produit", exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  for (const call of calls.filter(c => c.path.startsWith('/products') && c.method !== 'GET')) expect(call.authorization).toBe('Bearer test-token');
  await page.getByRole('button', { name: "Commandes", exact: true }).click();
  await expect(page.getByRole('heading', { name: "Vos commandes apparaîtront ici." })).toBeVisible();
});
test('admin mobile and order details with proposed contract', async ({ page }) => {
  await mockApi(page, { orders: true }); await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await expect(page.locator('tbody tr')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  await page.getByRole('button', { name: "Commandes", exact: true }).click();
  await page.getByRole('button', { name: "Voir la commande" }).click();
  await expect(page.getByRole('heading', { name: "Commande n°24", exact: true })).toBeVisible();
  await expect(page.getByText('Test address', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: "Fermer la fenêtre" }).click();
  await page.getByRole('button', { name: "Se déconnecter" }).click();
  await expect(page.getByRole('heading', { name: "Bienvenue." })).toBeVisible();
});
test('unavailable catalog shows honest error, not demo products', async ({ page }) => {
  await mockApi(page, { unavailable: true }); await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('alert').first()).toContainText('temporairement indisponible');
  await expect(page.locator('#shop .product-card')).toHaveCount(0);
});

test('sold-out banner and floating bag work at desktop and mobile sizes', async ({ page }) => {
  await mockApi(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('http://127.0.0.1:5173');
    const soldOut = page.locator('#shop .product-card').filter({ hasText: 'Omega 3' });
    await expect(soldOut.locator('.sold-out-banner')).toHaveText("RUPTURE DE STOCK");
    await expect(soldOut.getByRole('button', { name: "Ajouter Omega 3 au panier" })).toBeDisabled();
    await page.getByRole('button', { name: "Ajouter Vitamin C 1000 mg au panier" }).click();
    const bag = page.getByRole('button', { name: /Voir le panier, \d+ article\(s\)/ });
    await page.locator('.store-footer').scrollIntoViewIfNeeded();
    await expect(bag).toBeInViewport();
    await bag.click();
    await expect(page.getByRole('dialog')).toContainText('Vitamin C 1000 mg');
    await page.getByRole('button', { name: "Fermer la fenêtre" }).click();
  }
});

test('Arabic storefront keeps the bag, persists language and submits unchanged API fields', async ({ page }) => {
  const calls = await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'Ajouter Vitamin C 1000 mg au panier' }).click();
  await page.getByLabel('Langue', { exact: true }).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('status')).toContainText('تمت إضافة Vitamin C 1000 mg إلى السلة');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByLabel('اللغة', { exact: true })).toHaveValue('ar');
  await expect(page.locator('#shop .product-card')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/storefront-ar-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'فيتامينات', exact: true }).first().click({force:true});
  await expect(page.locator('#shop .product-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'فتح السلة، عدد المنتجات: 1' }).click();
  await page.getByRole('button', { name: 'متابعة الطلب', exact: true }).click();
  await page.getByLabel('الاسم الكامل').fill('محمد أمين');
  await page.getByLabel('رقم الهاتف').fill('0555000000');
  await page.getByLabel('عنوان التوصيل').fill('الجزائر العاصمة');
  await page.screenshot({ path: 'test-results/checkout-ar-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'تأكيد الطلب', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تم استلام الطلب رقم 24' })).toBeVisible();
  const order = calls.find(c => c.path === '/orders' && c.method === 'POST');
  expect(order.data).toEqual({customerFullName:'محمد أمين', customerPhoneNumber:'0555000000', customerAdress:'الجزائر العاصمة', items:[{productId:3,quantity:1}]});
  await page.getByRole('button', { name: 'إغلاق النافذة' }).click();
  await page.getByLabel('اللغة', { exact: true }).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('Arabic admin login, product creation and order actions preserve JWT and data', async ({ page }) => {
  const calls = await mockApi(page, { orders: true });
  await page.goto('http://127.0.0.1:5174');
  await page.getByLabel('Langue', { exact: true }).selectOption('ar');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await page.getByLabel('اسم المستخدم', {exact:true}).fill('admin');
  await page.getByLabel('كلمة المرور', {exact:true}).fill('wrong');
  await page.getByRole('button', {name:'تسجيل الدخول',exact:true}).click();
  await expect(page.getByRole('alert').first()).toContainText('اسم المستخدم أو كلمة المرور غير صحيحة.');
  await page.getByLabel('كلمة المرور', {exact:true}).fill('test-only-password');
  await page.getByRole('button', {name:'تسجيل الدخول',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:`test-results/admin-ar-${width}.png`,fullPage:true });
  }
  await page.getByRole('button', {name:'إضافة منتج',exact:true}).click();
  await page.getByLabel('اسم المنتج', {exact:true}).fill('فيتامين تجريبي');
  await page.getByLabel('الفئة', {exact:true}).selectOption('1');
  await page.getByLabel('سعر الوحدة (د.ج.)').fill('2200');
  await page.getByLabel('الوصف', {exact:true}).fill('وصف عربي');
  await page.getByRole('button', {name:'إنشاء المنتج',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(9);
  const product=calls.find(c=>c.path==='/products' && c.method==='POST');
  expect(product.data).toEqual({productName:'فيتامين تجريبي',category:1,unitPrice:2200,description:'وصف عربي',isWomenProduct:false});
  expect(product.authorization).toBe('Bearer test-token');
  await page.getByRole('button',{name:'الطلبات',exact:true}).click();
  await page.getByRole('button',{name:'عرض الطلب'}).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('قيد الانتظار');
  await page.getByRole('button',{name:'تأكيد الطلب',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('قيد التوصيل');
  expect(calls.find(c=>c.path==='/orders/24/confirm').authorization).toBe('Bearer test-token');
  await page.getByRole('button',{name:'إغلاق النافذة'}).click();
  await page.getByLabel('اللغة',{exact:true}).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('tbody')).toContainText('En livraison');
});

test('existing errors follow the selected language', async ({ page }) => {
  await mockApi(page, {unavailable:true});
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('alert').first()).toContainText('temporairement indisponible');
  await page.getByLabel('Langue',{exact:true}).selectOption('ar');
  await expect(page.getByRole('alert').first()).toContainText('المتجر غير متاح مؤقتًا.');
});

test('admin order actions confirm, deliver and cancel with JWT', async ({ page }) => {
  const calls = await mockApi(page, { orders: true });
  await login(page);
  await page.getByRole('button', { name: "Commandes", exact: true }).click();
  await page.getByRole('button', { name: "Voir la commande" }).click();
  await page.getByRole('button', { name: "Confirmer la commande", exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText("En livraison");
  await page.getByRole('button', { name: "Marquer comme livrée", exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText("Livrée");
  await expect(page.getByRole('button', { name: "Annuler la commande", exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: "Fermer la fenêtre" }).click();
  // Reload the mocked pending order for an independent cancellation scenario.
  await page.getByRole('button', { name: "Actualiser les données" }).click();
  await page.getByRole('button', { name: "Voir la commande" }).click();
  await page.getByRole('button', { name: "Annuler la commande", exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Le stock ne sera pas rétabli automatiquement');
  await page.getByRole('button', { name: "Confirmer l’annulation", exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText("Annulée");
  const changes = calls.filter(c => c.path.startsWith('/orders/') && c.method === 'PATCH');
  expect(changes.map(c => c.path)).toEqual(['/orders/24/confirm', '/orders/24/delivered', '/orders/24/cancel']);
  for (const call of changes) expect(call.authorization).toBe('Bearer test-token');
});

test('packs have separate cart IDs, shared stock and mixed checkout lines', async ({page})=>{
  const calls=await mockApi(page,{packs:true});
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('link',{name:'Nos bonnes affaires',exact:true}).click();
  await expect(page.locator('#deals .product-card')).toHaveCount(1);
  await expect(page.locator('.pack-details')).toContainText('Économisez');
  await page.getByRole('button',{name:'Ajouter Starter Pack au panier'}).click();
  await page.getByRole('button',{name:'Tous les produits',exact:true}).click({force:true});
  await page.getByRole('button',{name:'Ajouter Whey Protein · Chocolate au panier'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Ouvrir le panier, 2 article(s)'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.cart-item')).toHaveCount(2);
  // 11 direct units plus 1 pack use all 12 units of the same underlying product.
  const increase=dialog.getByRole('button',{name:'Augmenter la quantité de Whey Protein · Chocolate',exact:true});
  for(let n=0;n<10;n++) await increase.click();
  await expect(increase).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'Augmenter la quantité de Starter Pack',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Finaliser la commande',exact:true}).click();
  await page.getByLabel('Nom complet').fill('Test');await page.getByLabel('Numéro de téléphone').fill('0555000000');await page.getByLabel('Adresse de livraison').fill('Test address');
  await page.getByRole('button',{name:'Passer commande',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Commande n°24 reçue'})).toBeVisible();
  expect(calls.find(c=>c.path==='/orders'&&c.method==='POST').data.items).toEqual([{packId:1,quantity:1},{productId:1,quantity:11}]);
});

test('dedicated collections show discounts, real rankings and women products in French and Arabic', async ({page})=>{
  await mockApi(page,{packs:true});
  await page.route('**/api/products/best-sellers',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([3,1])}));
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.category-carousel .category-tabs').first().getByRole('button')).toHaveCount(12);
  expect(await page.locator('.category-marquee').evaluate(element => getComputedStyle(element).animationName)).toBe('category-ticker');
  await page.locator('.category-carousel .category-tabs').first().getByRole('button',{name:'Protéines',exact:true}).click({force:true});
  await expect(page.locator('#shop .product-card')).toHaveCount(4);
  await page.locator('.category-carousel .category-tabs').first().getByRole('button',{name:'Tous les produits',exact:true}).click({force:true});
  await expect(page.locator('#deals h2')).toHaveText('Nos bonnes affaires');
  await expect(page.locator('#deals .product-card')).toHaveCount(1);
  await expect(page.locator('#deals del')).toBeVisible();
  await expect(page.locator('#deals .product-bottom strong')).toHaveText(new Intl.NumberFormat('fr-DZ',{style:'currency',currency:'DZD',maximumFractionDigits:0}).format(9000));
  await expect(page.locator('#best-sellers .product-name')).toHaveText(['Vitamin C 1000 mg','Whey Protein · Chocolate']);
  await expect(page.locator('#women .product-name')).toHaveText(['Daily Multivitamin']);
  await expect(page.locator('#women .woman-icon')).toBeVisible();
  await page.locator('#best-sellers').getByRole('button',{name:'Ajouter Vitamin C 1000 mg au panier'}).click();
  await page.locator('#women').getByRole('button',{name:'Ajouter Daily Multivitamin au panier'}).click();
  await expect(page.getByRole('button',{name:'Voir le panier, 2 article(s)'})).toBeVisible();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/collections-fr-${width}.png`,fullPage:true});
  }
  await page.getByLabel('Langue',{exact:true}).selectOption('ar');
  await expect(page.locator('#deals h2')).toHaveText('عروضنا المميزة');
  await expect(page.locator('#best-sellers h2')).toHaveText('الأكثر مبيعًا');
  await expect(page.locator('#women h2')).toHaveText('للنساء');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/collections-ar-mobile.png',fullPage:true});
});

test('admin pack creation, edit, deactivate, reactivate and protected deletion', async ({page})=>{
  const calls=await mockApi(page,{packs:true});await login(page);
  await page.getByRole('button',{name:'Packs',exact:true}).click();
  await page.getByRole('button',{name:'Créer un pack',exact:true}).click();
  await page.getByLabel('Nom du pack').fill('New Pack');
  await page.getByLabel('Prix du pack (DZD)').fill('8000');
  await page.getByLabel('Produit du pack 1',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Ajouter un produit au pack'}).click();
  await page.getByLabel('Produit du pack 2',{exact:true}).selectOption('3');
  await page.getByRole('button',{name:'Enregistrer le pack'}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button',{name:'Modifier New Pack',exact:true}).click();
  await page.getByLabel('Quantité 1',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Enregistrer le pack'}).click();
  const row=page.locator('tbody tr').filter({hasText:'New Pack'});
  await row.getByRole('button',{name:'Désactiver',exact:true}).click();
  await expect(row).toContainText('Inactif');
  await row.getByRole('button',{name:'Activer',exact:true}).click();
  await expect(row).toContainText('Actif');
  await page.getByRole('button',{name:'Supprimer New Pack',exact:true}).click();
  await page.getByRole('button',{name:'Supprimer le pack',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Supprimer Starter Pack',exact:true}).click();
  await page.getByRole('button',{name:'Supprimer le pack',exact:true}).click();
  await expect(page.getByRole('alert').first()).toContainText('Ce pack figure dans des commandes');
  await page.getByRole('dialog').getByRole('button',{name:'Désactiver',exact:true}).click();
  await expect(page.locator('tbody')).toContainText('Inactif');
  for(const c of calls.filter(c=>c.path.startsWith('/packs')&&c.method!=='GET')) expect(c.authorization).toBe('Bearer test-token');
  expect(calls.find(c=>c.path==='/packs'&&c.method==='POST').data.items).toEqual([{productId:1,quantity:1},{productId:3,quantity:1}]);
  await page.getByLabel('Langue',{exact:true}).selectOption('ar');
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'الباقات',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/packs-admin-ar.png',fullPage:true});
});
