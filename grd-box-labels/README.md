# GRD box labels

`output/GRD Box Labels.psd` has one 1700×1080 artboard per product, laid out like the
GardenTerra 9"×9" clamshell box label. `output/previews/` has a PNG of each label.

Layers on each artboard (top to bottom):

| Layer | Kind |
|---|---|
| Product › Art | Embedded smart object (the line art, trimmed, white inside, transparent outside) |
| Quantity › QTY Text / QTY Box | Live text / raster outline |
| Distributor | Live text |
| Compostable › 100% / Compostable Text | Live text. Space on the left is left free for the icons |
| Product Name | Live text |
| Size | Live text |
| Badge › Badge Text / Badge Shape | Live text / raster |
| Logo | Raster, cut from the reference label |
| Background | Raster wave (`source/template/label-background.png`) |

Text uses Montserrat (Bold, SemiBold, Medium). When Photoshop opens the file it asks to
update the text layers. Choose **Update**.

## Rebuilding

```sh
npm install
python3 prep_assets.py   # needs Pillow and NumPy; writes build/
node build_psd.js        # writes output/
```

Wording, quantities and fonts are in `PRODUCTS` and `LAYOUT` at the top of `build_psd.js`.
