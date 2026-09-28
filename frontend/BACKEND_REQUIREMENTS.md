# Current frontend/API contract

## Catalog and categories

`GET /products` returns all products. Optional `?category=Proteine` filters by enum name.
`GET /products/{id}` returns the product or 404. Both are public.

Each product has a persistent `salesCount`. Creating an order increments it by the
underlying quantity consumed: direct product quantity plus component quantities from
packs. Stock and sales are updated in the same transaction, so failed orders change
neither value. Cancellation currently does not decrease the counter.

`GET /products/best-sellers` returns up to four product IDs ordered by `salesCount`,
with ID as a tie-breaker. It exposes no order/customer details. An empty ranking displays
an honest empty state in the storefront.

Categories, in enum order (0–10): `Proteine`, `Creatine`, `MassGainer`, `PreWorkout`,
`Vitamin`, `Snack`, `Boisson`, `Booster`, `FatBurner`, `AcidesAmine`, `Collagene`.
The UI translates the labels without changing these identifiers. Product writes use
numeric category values. Database values remain enum strings.

## Packs

- Public `GET /packs`: active packs with component names, quantities and prices.
- Public `GET /packs/{id}`: pack details.
- Admin `GET /packs/all`: active and inactive packs, allowing reactivation.
- Admin `POST /packs` and `PUT /packs/{id}`: `{ packName, description, packPriceDZD, items: [{ productId, quantity }] }`.
- Admin `PATCH /packs/{id}/active?isActive=false` (or `true`): no body.
- Admin `DELETE /packs/{id}`: 409 if used in orders; deactivate instead.

Original price is computed from current component prices. Positive savings are displayed
as a discount. Availability is computed from component stock fetched with the catalog;
the backend performs the authoritative stock check at checkout.

## Orders

Public `POST /orders` retains `customerFullName`, `customerPhoneNumber`, `customerAdress`.
Every item is either `{ productId, quantity }` or `{ packId, quantity }`, never both.
The cart aggregates shared component demand across products and packs.

Both order creation and admin `GET /orders` return snapshot items:
`{ productId: number|null, packId: number|null, itemName, quantity, unitPriceDZD }`.
Pack prices are for one complete pack; multiply by the ordered quantity only.
The API returns DTOs to avoid EF navigation cycles.

Admin status routes are `PATCH /orders/{id}/confirm`, `/cancel`, `/delivered`.
They return `true`, or 404 for a missing order. Status values are 0 Pending, 1 InDelivery,
2 Delivered, 3 Cancelled. Cancellation does not restore stock. The UI explains this;
backend transition guards and restocking remain separate business-rule improvements.

## Database update

Run `dotnet ef database update` from the API project directory. The existing
`AddPacksAndOrderPackSupport` migration creates tables and nullable order references.
`AddPacksAndOrderSnapshots` only converts old category strings and fills empty historical
item names from current product names. Old names cannot be reconstructed exactly if a
product was renamed before snapshots existed. The category conversion is one-way;
rollback requires a backup. No live database was changed during frontend verification.

`AddProductSalesCount` adds the persistent counter and backfills historical direct-product
order quantities. Historical pack-component sales are left at zero because pack contents
can change and were not snapshotted. New pack orders count every underlying component.

## Remaining behavior

Deleting a product referenced by an order or pack still returns the API's generic 500;
the UI keeps the row and reports the failure. A specific 409 would improve this response.
Order history is currently unpaginated. Production needs an `/api` reverse proxy or CORS
allowing the exact frontend origins. All administrative actions require a valid admin JWT.
