// Packs and products share presentation fields, but retain separate cart identities.
export function packProduct(pack, products) {
  const quantities = pack.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    return product && item.quantity > 0 ? Math.floor(product.stockQuantity / item.quantity) : 0;
  });
  return { ...pack, id: `pack:${pack.id}`, packId: pack.id, productName: pack.packName,
    productUnitPriceDZD: pack.packPriceDZD, productCategory: 'Packs',
    stockQuantity: pack.isActive && quantities.length ? Math.min(...quantities) : 0 };
}
export function stockDemand(cart, catalog) {
  const demand = new Map();
  for (const line of cart) {
    const entry = catalog.find(p => p.id === line.id);
    if (!entry) continue;
    for (const item of entry.packId ? entry.items : [{ productId:entry.id, quantity:1 }])
      demand.set(item.productId, (demand.get(item.productId) || 0) + item.quantity * line.quantity);
  }
  return demand;
}
export function fitsStock(cart, catalog) {
  if (cart.some(line => !catalog.some(p => p.id === line.id && p.stockQuantity >= line.quantity))) return false;
  return [...stockDemand(cart, catalog)].every(([id, quantity]) => quantity <= (catalog.find(p => p.id === id)?.stockQuantity ?? 0));
}
export function orderLines(cart) {
  return cart.map(line => typeof line.id === 'string'
    ? { packId: Number(line.id.slice(5)), quantity:line.quantity }
    : { productId:line.id, quantity:line.quantity });
}
