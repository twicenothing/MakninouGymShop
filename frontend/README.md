# Makninou Nutrition — React apps

Two independent React applications share branding and the API client:

Both interfaces default to French. The language selector switches to Arabic with a
right-to-left layout, including the admin login screen. The selection is saved in
local storage for each app origin. Product names and descriptions remain as entered
in the database. Translations live in `shared/translations.js`; language state and
currency formatting are in `shared/i18n.jsx`. Language switching needs no migration;
the pack/category update below does.

- Storefront: `apps/storefront`, http://localhost:5173
- Admin: `apps/admin`, http://localhost:5174

## Start locally

Before starting the updated API, run `dotnet ef database update` from the API directory.
The existing pack migration creates the pack tables; the follow-up data migration moves
old `Complement` products to `Proteine`, renames `Vitamine` to `Vitamin`, and fills empty
order item names from their current product names. Review the temporarily classified
protein products in admin. The data conversion cannot automatically be reversed.

To add the optional display catalog (14 products and 4 packs) in development, run:

```powershell
dotnet run -- --seed-demo-catalog
```

Product pictures are managed from the product form in the admin app. The API stores
the files in `wwwroot/uploads/products` and exposes them as static files. Images can
also be managed directly with an admin JWT:

- `PUT /products/{id}/image` — `multipart/form-data`, field name `image`
- `DELETE /products/{id}/image`

Accepted formats are JPG, PNG and WebP, up to 5 MB.

The command applies pending migrations first and is safe to run again: it adds only
missing demo names and never overwrites existing products, stock, sales or packs.

Start the .NET API with the HTTPS launch profile (https://localhost:7047), then:

```powershell
cd frontend
npm install
npm run dev:store
```

In another terminal in `frontend`:

```powershell
npm run dev:admin
```

Log in to the admin app using the account you created through `/admin/setup`.
The JWT is kept in memory and cleared on sign-out, expiry or an API 401. Reloading the
admin app requires logging in again. Product write permissions are enforced by the API.

Vite proxies `/api` to the backend; local CORS changes are not needed. If the API runs on
a different address, copy `.env.example` to `.env` and change `API_TARGET`. Restart Vite.
The local proxy accepts the development HTTPS certificate. Production must use verified HTTPS.

## What works

- Live product catalog, category and women’s collection filters, search and sorting.
- All 11 product categories, with French and Arabic labels and unchanged API enum values.
- Product and pack details, pack contents, original price and savings when discounted.
- Bag saved on this device, quantities, checkout, and the real `POST /orders` flow.
- No payment collection or assumed shipping charges. Prices are in DZD.
- Admin login, product creation/editing/deletion, and atomic stock adjustments.
- Admin pack creation/editing, activation/deactivation, and deletion. Inactive packs
  remain visible in admin. Packs used in orders can be deactivated instead of deleted.
- Mixed product/pack carts use separate identities and check shared component inventory.
- Admin order list and details, with confirm, cancel and mark-as-delivered actions.
  No demo orders or sales numbers are shown. Cancellation currently does not restore stock.

Product images are intentionally omitted. Cards use brand typography and the supplied logo.
Fonts use Google Fonts with local system fallbacks.

## Backend work for you

See `BACKEND_REQUIREMENTS.md` for endpoint contracts and remaining backend improvements.
The order list and three status routes are now protected with the Admin policy. Missing-order
responses check the service's boolean result correctly.

## Build and deploy

```powershell
npm run build
```

Deploy `dist/storefront` and `dist/admin` as separate static sites/origins. Do not deploy the
repository or appsettings files. On each origin proxy `/api/*` to the .NET API, stripping
the `/api` prefix, or set `VITE_API_URL=https://your-api.example` before building and allow
the two frontend origins in the API’s CORS policy. Vite’s proxy only runs during development.
Only public API addresses may go into VITE variables, never SMTP or JWT signing secrets.

The backend .csproj excludes `frontend/**` from its package to keep React dependencies
and source separate from the API publish output.

## Browser checks

```powershell
npx playwright install chromium
npm test
```

Tests mock network responses: they exercise catalog filtering, bag/checkout, login,
product and pack writes, stock, deletion, mixed orders, and mobile layout without
modifying your database or sending email. Screenshots are under `test-results`.
