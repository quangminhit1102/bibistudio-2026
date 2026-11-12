# Editable delivery-slip print

Approved direction: the owner reviewed the local prototype and requested integration and production deployment. On 12 November they explicitly chose current dump/browser data rather than migrating business modules to MySQL now.

## Intent and scope

The saved purchase-slip detail opens an editable delivery-slip print draft. Its A4 portrait output follows the reviewed reference: sender, customer/address, seven-column product table, gray headings, yellow totals, amount in Vietnamese words, and two centered signature blocks. Do not print Excel chrome or the admin shell.

## Approaches

- Updating the original slip before printing was rejected: it would change business records and reports.
- A separate transient print draft was selected. It is populated from existing related customer/product data and saved line quantities/prices, and can be freely edited without writes.
- Migrating the business modules to MySQL is deferred by the owner. A typed read-source boundary keeps a future HTTP adapter possible without changing the print editor or calculation code.

## Behavior and constraints

Use the saved slip as the financial baseline. Prefer the linked customer name/address and product name/SKU when readable; use the slip snapshots with a notice when a relation is absent or unavailable due to permissions. Other loading failures must offer retry. Preserve product IDs and line IDs internally; printed codes remain strings. No write to customers, products, slips, audit or reports is caused by printing. Closing resets the temporary draft on the next opening; no persistent print-draft storage is introduced.

Sender defaults follow the supplied reference and remain editable. Default VAT enabled follows the saved slip flag, default rate 8% is editable and is a template setting, not a legal tax determination. Prices are pre-tax. Sum integer VND line amounts, calculate VAT once on the subtotal, round half up to the nearest VND, then calculate grand total and words from the same result. Disabled VAT hides its row and adds zero tax. Validate date, quantities, prices, rate (0–100%, two decimals), required names and safe totals before allowing print. Maximum 100 lines.

Prioritize buyer/date/VAT and products; collapse sender/signature settings. Desktop has editor plus preview, mobile has explicit editor/preview modes. Use an isolated same-origin, script-free iframe for the exact printable document so admin print styles cannot leak. Browser native print allows PDF; no new dependencies. Repeat headers across pages, avoid splitting lines/totals/signatures and permit long names to wrap. Center date, role, hint and optional name in each signature column.

## Verification and release

Test adapter precedence/fallback/errors, immutable original records, VAT on/off/rounding/limits, words and escaping, editor interactions and print readiness. Run project checks/build and inspect actual local UI at desktop/mobile, then publish through existing CI main artifact/manual production workflow. Preserve previous production release for rollback, verify deployed version and browser behavior. No schema or hosting permission changes.
