# Color Analysis Tools Source of Truth

Last verified against code: 2026-08-16

This document describes the current behavior of the Your Color Style color analysis tools, customer palette access, My Clients, My Color Palettes, Photo Prep, Draping Studio, Style Masters, and Report Builder. It is intended to replace older working notes when they conflict with the code.

Primary code areas:

- Shopify theme:
  - `shopify-theme/templates/customers/account.liquid`
  - `shopify-theme/sections/my-palettes.liquid`
  - `shopify-theme/sections/my-clients.liquid`
  - `shopify-theme/sections/photo-prep.liquid`
  - `shopify-theme/sections/color-analysis-tool.liquid`
  - `shopify-theme/sections/signature-color-analysis.liquid`
  - `shopify-theme/sections/photo-draping.liquid`
  - `shopify-theme/sections/style-masters-library.liquid`
  - `shopify-theme/assets/ycs-my-clients.js`
  - `shopify-theme/assets/ycs-color-analysis-tool.js`
  - `shopify-theme/assets/signature-color-analysis.js`
  - `shopify-theme/assets/ycs-photo-draping.js`
- App backend:
  - `app/routes/api.create-consultant-client.jsx`
  - `app/routes/api.update-consultant-client.jsx`
  - `app/routes/api.admin-customer-palette-access.jsx`
  - `app/routes/api.trade-palette-credits.jsx`
  - `app/routes/api.trade-palette-credit-order.jsx`
  - `app/routes/webhooks.orders.paid.jsx`
  - `app/routes/api.save-draped-image.jsx`
  - `app/services/trade-palette-access.server.js`
  - `app/services/trade-palette-credits.server.js`
  - `app/services/palette-credit-orders.server.js`
  - `app/services/shopify-admin.server.js`

## Access Tags

Customer permissions are controlled primarily by Shopify customer tags. Tag checks are case-insensitive in the theme because tags are joined, uppercased, and wrapped with commas before matching.

### Tool Access Tags

- `YCS_ADMIN`
- `TRADE`
- `TRADEJULYCOHORT`, treated as TRADE only until August 25, 2026
- `CATOOL`
- `CATOOLGROWTH`
- `CATOOLFREE`
- `DIYCATOOL`
- `FREEDIYCATOOL`

### Palette And Customer Access Tags

- YCS palette tags:
  - `CCL`, `CCM`, `CCD`
  - `CWL`, `CWM`, `CWD`
  - `SCL`, `SCM`, `SCD`
  - `SWL`, `SWM`, `SWD`
  - `CWLG`, `CWMG`, `CWDG`
  - `SWLG`, `SWMG`, `SWDG`
  - `LO`, `MO`, `DO`
- `VIP`
- `DRAPINGSTUDIO`
- `DRAPINGSTUDIOSTARTER`
- `SAMPLE`
- `STYLEMASTERS_...` issue tags

## My Account

The customer account page always shows these resource buttons:

- My Color Palettes: `/pages/my-palettes`
- Downloads: `/pages/digital-downloads`
- Manage Subscriptions: `/tools/memberships`

The Color Analysis Tools button appears when the customer has any of:

- `YCS_ADMIN`
- `TRADE`
- unexpired `TRADEJULYCOHORT`
- `CATOOL`
- `CATOOLGROWTH`
- `CATOOLFREE`
- `DIYCATOOL`
- `FREEDIYCATOOL`

The Color Analysis Tools button links to:

- `/pages/my-palettes?view=catools`

The Style Masters Hub button appears when the customer has:

- `VIP`
- a `STYLEMASTERS_...` entitlement tag
- a qualifying Style Masters order/product purchase found in the customer order history

The Style Masters Hub button links to:

- `/pages/style-masters-library`

## Color Analysis Tools Page

The Color Analysis Tools page behavior exists in the My Palettes/tools sections, including `my-palettes.liquid` and the dedicated `color-analysis-tools.liquid` section. The tools view is used when the URL indicates the tools page, including:

- `/pages/my-palettes?view=catools`
- `/pages/my-palettes?view=tools`
- `/pages/color-analysis-tools`

The page top navigation says:

- Back to My Account

The page heading is:

- Color Analysis Tools

The page can show:

- My Clients card
- Color Analysis Tool card
- Training Curriculum card
- YCS digital palette cards
- Custom palette management, for CATOOLGROWTH and actual YCS_ADMIN

### Who Can Use The Color Analysis Tools Page

The tools page is available to:

- `YCS_ADMIN`
- `TRADE`
- unexpired `TRADEJULYCOHORT`
- `CATOOL`
- `CATOOLGROWTH`
- `CATOOLFREE`
- `DIYCATOOL`
- `FREEDIYCATOOL`

### Full Palette Access On Tools Page

On the Color Analysis Tools page only, the following roles see all standard YCS palette cards unlocked:

- `YCS_ADMIN`
- `TRADE`
- unexpired `TRADEJULYCOHORT`
- `CATOOL`
- `CATOOLGROWTH`

The following tool roles can use tools but do not receive all-palette access from the tools-page all-access gate:

- `CATOOLFREE`
- `DIYCATOOL`
- `FREEDIYCATOOL`

### Printable PDF Buttons

Printable PDF access is broader than palette-card access, but the exact all-access roles differ slightly between the normal My Color Palettes section and the dedicated tools section.

On normal My Color Palettes, PDF buttons are shown for rendered palette cards when any of the following is true:

- customer is `YCS_ADMIN`
- customer is `TRADE` or unexpired `TRADEJULYCOHORT`
- customer has the specific palette tag for that palette

On the dedicated Color Analysis Tools section, all-PDF access is granted to:

- `YCS_ADMIN`
- `TRADE` or unexpired `TRADEJULYCOHORT`

Otherwise the customer needs the specific palette tag for that palette.

`CATOOL` and `CATOOLGROWTH` users do not get all printable PDFs by role alone. They see a PDF button only when they personally have that palette tag. A `VIP` tag does not grant a PDF button for any color palette.

## My Clients

My Clients is available to users who can manage clients:

- `YCS_ADMIN`
- `TRADE`
- unexpired `TRADEJULYCOHORT`
- `CATOOL`
- `CATOOLGROWTH`

`CATOOLFREE`, `DIYCATOOL`, and `FREEDIYCATOOL` can use tool flows in other places, but they are not currently included in the My Clients page gate.

The My Clients top page menu includes:

- My Account
- Tools

When a single client is open, additional links can appear:

- My Clients
- Photo Prep
- Structured Analysis, only when relevant to a client/photo workflow
- Lip & Draping Studio, only when relevant to a client/photo workflow

The My Clients list displays clients in a grid. Each client card can show:

- adjusted photo if available
- otherwise uploaded/original photo if available
- otherwise upload placeholder
- first and last name
- email, or `No email`
- color type/palette if set
- View/Edit
- Delete
- Manage Client Photos
- Report Builder, when reports are allowed
- Structured Analysis, when the client has a photo
- Lip & Draping Studio, when the client has a photo

The list also includes:

- Add Client
- search by name or email
- filter by palette/color type
- sort controls

## Add Client

Add Client opens:

- `/pages/my-clients?newClient=1`

The Add Client top page menu includes:

- My Account
- Tools

The Add Client view shows:

- photo upload area
- first name
- last name
- email
- color palette
- notes
- Create Client
- Cancel

Cancel returns the user to My Clients.

The standalone admin "Give Color Palette to Customer" panel is hidden while Add Client is open.

### Required Fields

Email is optional when creating a client.

First and last name are effectively required unless the current user is `YCS_ADMIN` and enters the email address of an existing Shopify customer. In that admin case, the system can fill missing first/last name from Shopify before creating the client.

### YCS_ADMIN Add Client Behavior

When `YCS_ADMIN` enters an email, the frontend looks up the Shopify customer by email before creating the client.

If a matching Shopify customer exists:

- missing first name can be filled from Shopify
- missing last name can be filled from Shopify
- Shopify customer ID/GID can be saved on the client record
- the client is created in Airtable

If no matching Shopify customer exists and first or last name is missing:

- the client is not created
- the user must enter the missing names

### Non-Admin Add Client Behavior

For `TRADE`, unexpired `TRADEJULYCOHORT`, `CATOOL`, and `CATOOLGROWTH`:

- Add Client creates an Airtable client record only
- Shopify is not looked up during client creation
- Shopify customer linking happens later only if palette access is given

### Uploading A Photo During Add Client

Selecting the upload area during Add Client creates the client first, then sends the user to Photo Prep for that client.

## View/Edit Client

View/Edit Client opens a single client from My Clients.

The top menu includes:

- My Account
- Tools
- My Clients
- Photo Prep
- Structured Analysis, when the client has a photo
- Lip & Draping Studio, when the client has a photo

The screen displays:

- client photo if one exists
- otherwise an Upload Photo placeholder
- client name
- email, or `No email`
- color palette/color type
- created date
- updated date

Upload Photo opens Photo Prep for that client.

The edit form includes:

- First Name
- Last Name
- Email
- Color Palette
- Notes
- Save Changes
- Cancel

The screen can also include:

- Delete Client
- Manage Client Photos
- Report Builder
- Client Palette Access card
- Shopify Customer Palette Tags, for `YCS_ADMIN`

## Shopify Customer Palette Tags In View/Edit Client

Only `YCS_ADMIN` sees Shopify customer palette tags.

If the client is linked to a Shopify customer, or if the client can be found by Shopify email lookup, the tags display as removable pills with an `x`.

Removing a tag pill does not immediately change Shopify. The user must save the client for tag removals to apply.

TRADE users do not see Shopify customer tags.

## Giving A Color Palette To A Customer

There are two current palette-assignment entry points:

- standalone YCS_ADMIN panel on My Clients: "Give Color Palette to Customer"
- View/Edit Client Client Palette Access card

Palette access means the app adds the selected YCS palette code as a Shopify customer tag. That tag controls what the customer sees in My Color Palettes.

### Standalone YCS_ADMIN Flow

The standalone panel appears on My Clients for `YCS_ADMIN`, except while Add Client is open.

The admin enters:

- customer email
- palette code

The system:

1. Looks up the Shopify customer by email.
2. Requires an existing Shopify customer for this standalone flow.
3. Checks whether a My Clients record already exists for that Shopify customer/email.
4. If no client exists, prompts the admin:
   - Add to My Clients & Give Access
   - Give Access Only
   - Cancel
5. Adds the palette tag to the Shopify customer.
6. Creates a client only when the admin chooses to add the customer to My Clients.
7. Sends a legacy customer account invite when Shopify reports the customer account state is `DISABLED` or `INVITED`.
8. Attempts the optional palette-access notification webhook if `PALETTE_ACCESS_NOTIFICATION_WEBHOOK_URL` is configured.

If "Give Access Only" is selected, no client record is created.

The confirmation message for that case is:

- `Palette assigned: [Customer Name] now has access to [Palette Name]. No client record was created.`

### YCS_ADMIN View/Edit Client Flow

In View/Edit Client, `YCS_ADMIN` can give the selected palette to the client.

The system:

1. Requires the client email.
2. Looks up the Shopify customer by email.
3. Requires the Shopify customer to exist.
4. Adds the selected palette tag to the Shopify customer.
5. Links the client record to the Shopify customer.
6. Sends a legacy customer account invite when Shopify reports the customer account state is `DISABLED` or `INVITED`.
7. Attempts the optional palette-access notification webhook if `PALETTE_ACCESS_NOTIFICATION_WEBHOOK_URL` is configured.

### TRADE View/Edit Client Flow

TRADE users can give palette access to their own clients from View/Edit Client.

Requirements:

- client email
- selected color palette in the Client Palette Access card
- at least 1 color palette credit, unless usage for that exact client/palette has already been recorded

The system:

1. Verifies the logged-in customer has `TRADE`, unexpired `TRADEJULYCOHORT`, or `YCS_ADMIN`.
2. Finds the Airtable client by `consultantId` and `clientRecordId`.
3. Requires the client email.
4. Looks for an existing Shopify customer by email.
5. Uses the existing Shopify customer if found.
6. Creates a Shopify customer behind the scenes if none exists.
7. Adds the selected palette tag.
8. Links the Shopify customer ID/GID to the client record.
9. Sends a legacy customer account invite when Shopify reports the customer account state is `DISABLED` or `INVITED`.
10. Records a `usage` event for -1 color palette credit when the palette tag was newly added.

TRADE palette access currently sends the Shopify legacy account invite when needed. It does not use the optional `PALETTE_ACCESS_NOTIFICATION_WEBHOOK_URL` notification flow that the admin palette-access endpoint uses.

If the Shopify customer already had that palette tag:

- no new palette tag is added
- no new credit usage event is recorded
- the client can still be linked to the Shopify customer

The Client Palette Access card has its own palette selector. Choosing a palette there does not have to change the client's assigned Color Palette field. This allows a user to give multiple palettes to the same client over time.

## TRADE Color Palette Credits

TRADE color palette credits are stored as an Airtable ledger.

Credits are tracked as events:

- purchase events add credits
- usage events subtract credits

The balance is calculated from the ledger, not stored as a single mutable number.

Credit SKUs:

- `YCS-PALETTE-CREDITS-1`: 1 credit
- `YCS-PALETTE-CREDITS-5`: 5 credits
- `YCS-PALETTE-CREDITS-10`: 10 credits
- `YCS-PALETTE-CREDITS-20`: 20 credits

Credits are added when an order is paid through the `orders/paid` webhook.

The webhook:

1. Verifies Shopify HMAC using the Shopify API secret.
2. Reads paid order line items.
3. Matches color palette credit SKUs.
4. Writes a purchase event to the Airtable credit ledger.
5. Uses idempotency keys so repeat webhooks or backfills do not duplicate credits.
6. Writes webhook audit records.

If a TRADE user buys another package of the same SKU, the app records a separate purchase event keyed to that order and line item. The balance increases again.

In View/Edit Client, the Client Palette Access card displays the available color palette credit balance. If the balance is zero, the UI shows an action to buy credits and links to:

- `/products/color-palette-credits`

## Photo Upload Credits

Photo upload credits are checked by the app backend when uploading or replacing photos.

Monthly photo upload limits by current behavior:

- `YCS_ADMIN`: unlimited
- `CATOOL`: 5
- `CATOOLGROWTH`: 15
- `TRADE`: 15
- unexpired `TRADEJULYCOHORT`: 15
- `VIP`: 5 personal photo uploads

Fixed, non-monthly personal/sample upload allotments by current behavior:

- `DRAPINGSTUDIO`: 5 personal photo uploads
- `DRAPINGSTUDIOSTARTER`: 2 personal photo uploads
- `SAMPLE`: 1 sample/trial upload
- customers with a palette tag but no VIP/draping tag: 1 sample/trial upload through the sample path

Loading an original photo does not use a photo credit. Uploading a new photo or replacing a photo uses a photo credit.

## My Color Palettes

My Color Palettes is:

- `/pages/my-palettes`

The top page menu says:

- Back to My Account

The My Color Palettes button is shown broadly on My Account. The page requires a signed-in customer, and the useful page content is controlled by tags. Customers with these tags get the corresponding My Color Palettes features:

- customers with any standard YCS palette code tag
- `VIP`
- `DRAPINGSTUDIO`
- `DRAPINGSTUDIOSTARTER`
- `SAMPLE`
- `YCS_ADMIN`

### My Color Palettes Section

The My Color Palettes section displays standard YCS palette cards for the palette code tags the customer has.

VIP by itself does not unlock all standard YCS color palettes. A VIP customer sees standard YCS palette cards only when they have those specific palette code tags.

### Sample Palette

The Sample Color Palette is shown when:

- customer has `SAMPLE` and does not have paid draping studio access
- or the page allows sample trial access for a non-VIP, non-admin customer without paid draping studio access

Customers who see the Sample Color Palette can open it in Palette Viewer.

### Explore More Palettes

Unowned standard YCS palettes display under Explore More Palettes as locked cards.

Selecting the locked-card action sends the customer to the configured product link, or the expanded digital color palettes product fallback.

### My Photos Card

My Photos displays on My Color Palettes for customers with:

- a real YCS palette tag
- `VIP`
- `DRAPINGSTUDIO`
- `DRAPINGSTUDIOSTARTER`
- `SAMPLE`

The button says:

- Open My Photos

The My Photos card links to the personal Photo Prep flow:

- `/pages/photo-prep?mode=personal&workflow=photo-draping`

Customers with only a palette code tag, and no VIP/draping access, use the sample route:

- `/pages/photo-prep?mode=personal&workflow=photo-draping&trial=sample`

### Photo Draping Studio Card

The Photo Draping Studio card displays on My Color Palettes.

Access notes:

- `VIP` and `YCS_ADMIN` see "Included with your membership" and open the full studio path.
- `DRAPINGSTUDIOSTARTER` sees starter access.
- `DRAPINGSTUDIO` sees studio access.
- `SAMPLE` users see their free trial state.
- other customers may see a free trial/sample route.

### Style Masters Color Palettes Section

VIP customers see a Style Masters Color Palettes section on My Color Palettes.

This section is separate from standard YCS palette code tags. It loads Style Masters custom palettes from the app backend. Visible cards are controlled by Style Masters custom palette visibility, not by standard YCS palette tags.

Cards can include:

- Open Palette
- Draping Studio

`YCS_ADMIN` does not see the VIP version of this section. Admins manage Style Masters custom palettes through the tools/custom palette management area.

## My Photos And Personal Photo Prep

The personal photo prep URL is:

- `/pages/photo-prep?mode=personal&workflow=photo-draping`

The personal top page menu includes:

- My Account
- My Color Palettes

The page displays the customer's uploaded photos and actions such as:

- Open Draping Studio
- Adjust Photo
- Delete Photo
- Upload New Photo

The page includes photo adjustment tools for:

- zoom
- temperature
- brightness
- contrast

For sample/trial users, or palette-only users using the sample path, the upload limit is 1 photo.

## Photo Draping Studio

The personal draping studio URL has the form:

- `/pages/photo-draping?mode=personal&photoId=...&photoSource=PersonalStudioPhotos`

The top page menu includes:

- My Account
- My Color Palettes
- Photo Prep

The studio loads the selected personal photo and allows palette/drape testing.

## Photo Prep For Color Analysis Tool Users

Photo Prep has two major modes:

- client list / client creation workflow
- photo adjustment workflow

For color analysis tool users, the top page menu includes:

- My Account
- Tools
- My Clients
- Manage Client, when a client is selected
- Structured Analysis, when a client/photo context exists
- Lip & Draping Studio, when a client/photo context exists

Photo Prep behavior:

- original photo loads if available
- adjusted photo loads if available
- upload photo uses a photo credit
- replace photo uses a photo credit
- zoom, temperature, brightness, and contrast can be adjusted
- Save Adjusted Photo saves the adjusted photo
- Load Original Photo restores the original photo view without using a credit
- Structured Analysis opens the Color Analysis Tool
- Lip & Draping Studio opens the Lip & Draping Studio

## Structured Analysis

Structured Analysis is the Color Analysis Tool.

The page is:

- `/pages/color-analysis-tool`

The top page menu includes:

- My Account
- Tools
- My Clients
- Manage Client
- Photo Prep
- Lip & Draping Studio

The tool:

- loads the adjusted photo if available
- otherwise loads the original photo
- restores saved photo position and zoom when available
- supports Save Position and Restore Saved Position
- supports depth, undertone, and chroma workflow
- shows depth rings only on Depth view
- supports grayscale on Depth view
- supports realistic drapes for undertone and chroma, not depth
- loads saved lip shape if one exists
- shows saved lip shape only on Undertone view, in finished mode by default
- lets the user create or edit lip shape on Undertone view
- loads lip draping colors if a lip shape exists
- uses Choose buttons to move through the flow
- saves the final color type for the client from Chroma

Saved view buttons:

- Save Left View
- Save Right View

These save PNGs to the backend for later Report Builder use.

## Lip & Draping Studio

The Lip & Draping Studio page is:

- `/pages/signature-color-analysis`

Important technical note: this page loads:

- `shopify-theme/assets/signature-color-analysis.js`

It does not load:

- `shopify-theme/assets/ycs-color-analysis-tool.js`

When a save/export issue happens on `/pages/signature-color-analysis`, check `signature-color-analysis.js` first.

The top page menu includes:

- My Account
- Tools
- My Clients
- Manage Client
- Photo Prep
- Structured Analysis

The studio:

- loads adjusted photo if available
- otherwise loads original photo
- shows side-by-side left and right views
- restores saved photo position and zoom when available
- supports Save Position and Restore Saved Position
- provides a palette selector for each side
- lists all standard YCS palettes
- shows CATOOLGROWTH custom palettes at the top of the selector when available
- supports lip shape editing and hiding/showing lips
- loads lip colors for the selected palette when a lip shape exists

Saved view buttons:

- Save Left View
- Save Right View

Each view can be saved with optional labels:

- drape color name
- client first name plus color type
- lip color swatch/name

When name plus color type is selected:

- first name displays in the upper left
- color type code displays in the upper right, when available

When color name is selected:

- color name displays over the drape

When lip color name is selected and a lip color is selected:

- a square of that lip color and the lip color name are added to the lower left

## Saved Draped Images

Saved draped images are created from:

- Structured Analysis
- Lip & Draping Studio

When the user selects Save Left View or Save Right View:

1. The frontend renders the currently visible panel into a browser canvas.
2. The canvas is converted to a PNG data URL.
3. The PNG is posted to `/api/save-draped-image`.
4. The backend uploads the PNG to Cloudinary.
5. The backend creates a record in Airtable's `SavedDrapedImages` table.
6. The saved image becomes available to the Report Builder.

Saved fields include:

- client record ID
- customer ID
- consultant ID
- panel side
- palette code
- drape color name
- drape color hex
- lip color name
- lip color hex
- image URL
- generated draped image ID

### Saved Image Technical Guardrails

The biggest save/export break risk is canvas tainting.

If the browser canvas draws an image from Cloudinary, Shopify CDN, or another remote source without safe CORS handling, `canvas.toDataURL('image/png')` can throw a security error. In the UI this often appears as:

- `Could not save this view. Please try again.`

To prevent this, export code should pass remote images through:

- `/api/proxy-image?url=...`

before drawing them into the canvas.

The safer frontend pattern is:

```js
const canvasSafePhotoUrl = await getCanvasSafeImageUrl(state.loadedImageUrl);
const uploadedImg = await loadImage(canvasSafePhotoUrl);
```

Do not rely only on:

```js
img.crossOrigin = 'anonymous';
```

That only works when the remote server sends compatible CORS headers.

Avoid blindly drawing an existing lip canvas into the export canvas. If that lip canvas is already tainted, it can taint the final export too. The safer pattern is to check whether the lip canvas is export-safe and, if needed, redraw the lip shape directly from saved lip points.

When saved draped images break, check in this order:

1. Confirm which page is failing. `/pages/signature-color-analysis` uses `signature-color-analysis.js`.
2. Search for the alert text: `Could not save this view. Please try again.`
3. Check whether `/api/save-draped-image` is called.
4. If the API is never called, suspect canvas export/tainting.
5. Check all remote image sources drawn into the export canvas: uploaded photo, realistic drape overlay, depth overlay, and lip canvas.
6. Verify `/api/save-draped-image` separately with `imageBase64`, `clientRecordId`, `customerId`, `consultantId`, `paletteCode`, `panel`, color metadata, and `fileName`.
7. Deploy only the changed theme asset when fixing the failing page.

## Report Builder

Report Builder is available on View/Edit Client for:

- `YCS_ADMIN`
- `TRADE`
- unexpired `TRADEJULYCOHORT`
- `CATOOL`
- `CATOOLGROWTH`

Report Builder:

- loads below the client form
- replaces Manage Client Photos when selected
- is replaced by Manage Client Photos when that view is selected
- creates customized color analysis reports for the selected client
- loads the saved draft for the client when one exists
- loads default report pages when no saved draft exists

Reports use the selected client's:

- first name
- last name
- email, if available
- color type, if set
- saved draped images

The left page rail:

- displays all report pages in order
- lets the user select the full page tile, including page number and title
- keeps scroll position when selecting, copying, deleting, or reordering pages

Page rules:

- built-in report pages cannot be deleted
- users can delete only pages they created or copied
- supported pages can be copied
- copied pages display as original page name plus `Copy`
- copied pages act independently from the original
- copied pages have their own page title, copy/text, selected images, cleared image state, decision selections, and hide/show settings
- users can rename copied pages and custom pages
- users can reorder pages they created or copied
- reordering updates the page rail and report preview
- page numbers update based on current order

Image placeholder rules:

- selecting an image placeholder shows all saved draped photos for that client
- selecting a saved photo places it into the placeholder
- Clear Selection removes the selected photo
- saving a draft preserves intentionally empty photo spaces
- clearing a photo on a copied page does not restore or inherit the original page photo

Decision page rules:

- Depth, Temperature, and Chroma report pages allow choosing the result shown
- the selected result receives the green check mark
- choices on copied pages are independent from the original

Custom report pages:

- letter/text page
- 2-photo page
- 4-photo page

Saved drafts preserve:

- page order
- copied pages
- custom pages
- page titles
- text edits
- image selections
- cleared image selections
- decision selections
- hide/show settings

Loading a saved draft restores the report exactly as it was saved.

The current button label in code is:

- Print PDF

The intended function is to generate the report PDF without editing controls, preserving the report layout.

## Style Masters Hub

Style Masters Hub page:

- `/pages/style-masters-library`

Template:

- `page.style-masters-library.json`

Section:

- `shopify-theme/sections/style-masters-library.liquid`

Access:

- `VIP`
- `YCS_ADMIN`

The page shows locked messaging when the customer is not logged in or does not have access.

The top menu currently includes:

- My Account
- Schedule: `/pages/style-masters-schedule`
- Facebook Group: `https://www.facebook.com/groups/colorfulumembers`
- Hub: `/pages/style-masters-library`

Style Masters library items are issue/month driven. Issue metadata includes an `issue_period`, for example `2026-08`.

## Shopify Admin Token Requirements

Shopify Admin features require an Admin API token with scopes that include at least:

- `read_customers`
- `write_customers`
- `read_orders`, for order lookup/backfill and credit purchases
- `read_metaobjects`
- `write_metaobjects`
- `read_metaobject_definitions`
- `write_metaobject_definitions`
- `read_products`
- `write_products`

The app can use:

- stored offline Shopify session, if available
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- generated app token from `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`

For the current production setup, `SHOPIFY_ADMIN_ACCESS_TOKEN` should be a plain `shpat_...` token saved in Vercel Production.

`SHOPIFY_SYNC_SHOP` should resolve to:

- `yourcolorstyle.myshopify.com`

## Deployment Guardrails

For report builder work, keep changes scoped mainly to:

- `shopify-theme/sections/my-clients.liquid`
- `shopify-theme/assets/ycs-my-clients.js`

For Lip & Draping Studio save/export work, the primary asset is:

- `shopify-theme/assets/signature-color-analysis.js`

For My Color Palettes access and card visibility work, the primary section is:

- `shopify-theme/sections/my-palettes.liquid`

Do not invent new navigation links. Top page menus must follow the current user-flow permissions.

When deploying theme changes, deploy only changed theme files.

Stable report builder fallback:

- tag: `stable-report-builder-2026-08-13`
- commit: `c625549`
