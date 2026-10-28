# Local catalogue images for cPanel

## Intent and evidence

Restore product imagery on bibistudio.vn and make catalogue images independent of Lovable hosting. All 29 catalogue asset descriptors currently reference `/__l5e/assets-v1/`; none has its matching original image in `public/catalogue`. A production image request returns HTTP 200 with `text/html` (the SPA fallback), while an existing `/catalogue` image returns `image/webp`. The sampled original image on the Lovable published site returns `image/jpeg` with the expected byte length.

## Approaches

1. Download original images into `public/catalogue`, update descriptor URLs, and validate local images before builds. User selected this approach: portable static deployment, with the images included in the repository.
2. Point descriptors at absolute Lovable URLs. Smaller change, but retains the external hosting dependency. Rejected in favor of approach 1.

## Small change design

- Retrieve all 29 original image files from the project's published Lovable site. Validate HTTP success, image content type, and image file signatures before accepting downloads; never save an HTML fallback as an image. Stop and report any unavailable originals rather than substituting other artwork.
- Preserve existing ASCII filenames and original JPEG contents. This is the implementer's proposed default: restore faithfully without introducing image conversion or changing crops.
- Update only the `url` field in each asset descriptor to `/catalogue/<filename>`, preserving asset IDs and provenance. Existing catalogue imports, product descriptions, galleries, and layout remain intact.
- Add an offline validation command that rejects Lovable-only catalogue URLs, missing local files, and files whose bytes are not valid image signatures. Run it before the normal and cPanel production/temporary builds, so image errors stop deployment rather than slipping through a successful JavaScript build.
- Ensure the repaired descriptor images resolve under the configured Vite base path when using the temporary cPanel URL. Production URLs remain rooted at `/catalogue/`.
- Keep the existing cPanel deployment branch workflow. Do not rewrite published Git history or change server routing as a substitute for supplying the image files.

## Validation and delivery

Use meaningful regression tests covering unresolved Lovable URLs, missing files, HTML masquerading as images, and successful local image validation. Run the deploy test suite, build cPanel output, and verify that all 29 images are present and that affected catalogue URLs no longer contain `/__l5e/`. Check representative product, collection, and related-product images in a browser served from the repaired build.

The deliverable is repaired source and a verified production artifact ready to deploy. Publishing to the remote branch and applying the artifact on live hosting are separate from this source repair; report their actual status explicitly.

## Non-goals

No catalogue redesign, replacement images, journal changes, new hosting service, or unrelated deployment refactor.
