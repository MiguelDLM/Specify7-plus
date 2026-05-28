# Disclaimer

This extension was designed to satisfy my personal needs with Specify 7. Each user is responsible for their own use and configuration. Although it is unlikely to cause damage to your Specify installation, the author is not responsible for any issues, data loss, or malfunction.

This is a personal-use project and is not affiliated with or related to the official development of Specify 7 or its creators. Use at your own risk.

---

# Specify7+

Specify7+ is a browser extension for Chromium-based browsers that enhances Specify 7 with powerful productivity tools.

## 🚀 Features

### 📚 Bibliography Import (Reference Work form)
- ✅ Import BibTeX entries (modal opens with clipboard pre-filled for review)
- ✅ Import metadata by DOI from CrossRef (accepts bare DOI or `https://doi.org/...` URL)
- ✅ Automatic mapping from BibTeX/CrossRef to Specify 7 fields
- ✅ Auto-creates new author rows; when Specify opens the **New Agent** dialog
  for an unknown author, the extension correctly splits `lastName` /
  `firstName` / `middleInitial` (instead of dumping the whole "Last, First"
  search string into one field)
- ✅ Yellow **Crear «valor»** badge under any combobox (Journal, Author,
  Taxon, Locality, Paleo Context, Stratigraphy, etc.) whose typed value got
  wiped by Specify because the record doesn't yet exist in the database —
  one click refills the value so you don't lose your place

### 📦 JSON Specimen Import (Collection Object form)
- ✅ **Import JSON** + **Import from Clipboard** buttons on Collection
  Object forms
- ✅ Smart field matching that reads `aria-label`, `title`, `name`, `id`,
  `label` and `placeholder` — so the same JSON works whether Specify
  rendered the form via headless-ui (combobox pickers) or as a regular
  HTML form
- ✅ Semantic aliases for ambiguous keys: `stratigraphy`, `formation`,
  `member`, `geologicalAge`, `age` all match the **Paleo Context** picker;
  `collector` matches the Collectors / Cataloger row; etc.
- ✅ Automatically clicks the **+ Add** button on subforms (Determinations,
  Paleo Context, Collecting Event, Other Identifiers) when your JSON has
  values for them and no editable row exists yet
- ✅ Per-field paste buttons (small clipboard icons) appear next to each
  field, scoped to the data you actually imported

### 🔬 3D Model Viewer
- ✅ Classic Three.js 3D viewer with lighting and material controls
- ✅ Support for STL, OBJ, GLTF, GLB formats
- ✅ Reliable handling of large files via blob streaming
- ✅ Wireframe mode, rotation controls, fit-to-view

### ⚡ Query Tools
- ✅ **Select All** button for query results
- ✅ Simulates real click events for proper Specify 7 integration
- ✅ Works with all query result pages

### 🎛️ Feature Toggles
- ✅ Enable/disable features individually from the popup
- ✅ Persistent settings via `chrome.storage.sync`

## 📋 Compatible Fields

### BibTeX Reference Types → Specify 7

| BibTeX | Specify 7 |
|--------|-----------|
| `@book` | Book (0) |
| `@article` | Paper (2) |
| `@inbook`, `@incollection` | Section in Book (5) |
| `@techreport` | Technical Report (3) |
| `@phdthesis`, `@mastersthesis` | Thesis (4) |
| `@misc`, `@online` | Electronic Media (1) |

### Field Mapping

| BibTeX/CrossRef Field | Specify 7 Field |
|--------------|-----------------|
| `title` | Title |
| `publisher` | Publisher |
| `address`, `location` | Place Of Publication |
| `year`, `date` | Work Date |
| `volume` | Volume |
| `pages` | Pages |
| `journal`, `booktitle`, `container-title` | Journal |
| `number`, `isbn`, `doi` | Library Number |
| `author`, `editor` | Authors |

## 📦 Installation

Follow the usual steps for loading unpacked extensions in Chromium:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select this repository folder

The extension will add a popup and content-script hooks into Specify 7 pages.

## 🎯 Usage

### Bibliography Import

1. **Navigate to a Reference Work form** in Specify 7 — either standalone
   (`/specify/view/referencework/new/`) or as a modal opened from a
   Collection Object's **Citations** row. Only **Import BibTeX** and
   **Import DOI** appear in this context; **Import JSON** and **Import from
   Clipboard** stay scoped to the Collection Object form underneath, so the
   two contexts never bleed into each other.
2. **Import by DOI:**
   - Click the **Import DOI** button. The modal opens with the clipboard
     pre-filled if it contains something that looks like a DOI (bare
     `10.x/...` or a `https://doi.org/10.x/...` URL).
   - Press **Fetch** — metadata is pulled from CrossRef and the form fills.
3. **Or import BibTeX:**
   - Click **Import BibTeX**. The modal opens with the clipboard text
     pre-filled if it looks like BibTeX (`@type{...}`), pre-selected so
     `Ctrl+V` replaces it if you want a different entry.
   - Press **Import** when you're ready.
4. **Authors not yet in the database:** Specify pops up a **New Agent**
   dialog when you click **+ Add** in an author combobox. The extension
   correctly fills `lastName`, `firstName`, and `middleInitial` from the
   BibTeX author. While that dialog is open, the other author rows are
   protected by the **Crear «Last, First»** badge — one click refills any
   row that Specify wiped during the focus shift.
5. **Review and Save.**

### JSON Import (Collection Object form)

The JSON importer maps keys in your JSON to Specify form fields by scoring
candidates across `aria-label`, `title`, `name`, `id`, `<label for=…>`,
and `placeholder`. Accents, case, and stopwords are normalized; Spanish
and English labels both work.

1. Click the **Import JSON** button on a Collection Object form.
2. Paste your JSON entry and press **Import**.
3. The extension expands collapsed sections and, for each subform that
   needs an empty row (Determinations, Paleo Context, Collecting Event,
   Other Identifiers), clicks **+ Add** automatically before mapping.
4. Review the populated fields and save.

#### Smart matching: aria-label first, then semantic aliases

Specify renders most pickers (Taxon, Locality, Paleo Context, Determiner,
Collector) as `input[role="combobox"]` with `aria-label` as the canonical
label — `name`/`<label for=…>` are usually empty there. The importer
reads `aria-label` directly. For ambiguous keys it also tries semantic
aliases:

| Your JSON key                                      | Also matches (via alias)                        |
|----------------------------------------------------|-------------------------------------------------|
| `stratigraphy`, `formation`, `member`              | Paleo Context, Lithostratigraphy                |
| `geologicalAge`, `age`, `period`, `epoch`, `era`   | Paleo Context, Chronostratigraphy               |
| `lithostratigraphy`, `biostratigraphy`, `chronostratigraphy` | Paleo Context + the same-named tree    |
| `locality`                                         | Locality Name                                   |
| `collector`, `collectors`                          | Collectors row, Last Name, Agent                |
| `determiner`                                       | Determiner / Last Name                          |

#### "Crear «valor»" badge for unsaved tree entries

When the typed value of a tree-picked field (Taxon, Locality, Paleo
Context, Stratigraphy units, Journal, Author) doesn't match an existing
record, Specify wipes the value on the next focus change. The extension
catches that, leaves a yellow **+ Crear «valor»** badge below the field,
and a single click refills the typed value plus auto-clicks Specify's
autocomplete **+ Add** when present — so you can create the new tree node
without having to retype anything.

#### 🤖 LLM Prompt for Paleontology Data Extraction (Copilot / ChatGPT / Gemini)
You can use the following prompt to ask an AI assistant (like Microsoft Copilot) to extract paleontological specimen data from a scientific paper or text in the correct JSON format:

```text
Extract the paleontological specimen information from the text below. Format the output as a clean, flat JSON object. Use the following keys:
- "catalogNumber" (for the catalog or specimen number, e.g. "MCNAM-PV 450")
- "altCatalogNumber" (for the original or alternative catalog number from another collection, e.g. "MACN-A 10234")
- "institution" (for the institution or collection of origin, e.g. "Museo Argentino de Ciencias Naturales")
- "taxon" (for the scientific name of the fossil, e.g. "Carnotaurus sastrei")
- "locality" (for the geographic site or fossil locality)
- "stratigraphy" (for the geological formation, member, or bed, e.g. "La Colonia Formation")
- "geologicalAge" (for the epoch, age, or era, e.g. "Late Cretaceous")
- "collector" (for the person or expedition who collected the fossil)
- "date" (for the date of collection/discovery in YYYY-MM-DD format)
- "remarks" (for anatomical description, skeletal elements preserved, or general remarks, e.g. "Left femur and partial pelvis")

Provide ONLY the raw JSON object, without markdown formatting.

Text:
[PASTE TEXT OR PAPER HERE]
```

#### Sample JSON Structure
```json
{
  "catalogNumber": "MCNAM-PV 450",
  "altCatalogNumber": "MACN-A 10234",
  "institution": "Museo Argentino de Ciencias Naturales",
  "taxon": "Carnotaurus sastrei",
  "locality": "Estancia Ochoa, Chubut Province",
  "stratigraphy": "La Colonia Formation",
  "geologicalAge": "Late Cretaceous",
  "collector": "José Bonaparte",
  "date": "1984-11-23",
  "remarks": "Partially complete skeleton including skull, lower jaws, and postcranial elements."
}
```

### 3D Viewer

- Click any 3D model link (`.stl`, `.obj`, `.gltf`, `.glb`) in Specify 7
- The model opens in a new tab with the viewer
- Use mouse to rotate, zoom, and explore
- Adjust lighting and materials via the settings panel

### Query Tools

- Open any query results page in Specify 7
- Click the **Select All** button in the toolbar
- All checkboxes are selected with simulated click events
- Specify 7 recognizes the selection without page refresh

### Feature Toggles

- Click the extension icon to open the popup
- Toggle individual features on/off
- Settings are saved automatically

### Notes on DOI import

- Uses CrossRef REST API (`https://api.crossref.org/works/:doi`)
- Authors may need manual verification in the subform

### Notes on theming

- Modals and buttons mirror Specify's own dialog chrome: `border-radius: 6px`,
  `bg-gradient-to-bl from-gray-200/neutral-800` panels, the 2 px
  `border-brand-300` underline under the title, `text-transform: capitalize`
  on action buttons.
- Dark mode follows Specify's `body.dark` class (Tailwind class-based dark
  mode) and also `prefers-color-scheme: dark` so the modals look right
  outside the app.

## 🔧 Development

### Project Structure

```
bibliography-importer-Specify7/
├── manifest.json           # Extension manifest (MV3)
├── icons/                  # Extension icons
├── lib/                    # External libraries
│   └── three/              # Three.js and loaders
│       ├── three.min.js
│       ├── STLLoader.js
│       └── OrbitControls.js
└── src/                    # Source code
    ├── popup/              # Extension popup
    │   ├── popup.html
    │   ├── popup.css
    │   └── popup.js
    ├── content/            # Content scripts
    │   ├── content-script.js
    │   └── content-styles.css
    ├── viewer/             # 3D viewer
    │   ├── viewer.html
    │   ├── viewer.css
    │   └── viewer.js
    └── utils/              # Utilities
        └── bibtex-parser.js
```

### Building & Testing

1. Make changes to files in `src/`
2. Reload the extension in `chrome://extensions`
3. Test the feature in a Specify 7 instance

### Adding New Features

Features are toggled via the popup. To add a new feature:

1. Add a checkbox in `src/popup/popup.html`
2. Update `src/popup/popup.js` to save the preference
3. Update `src/content/content-script.js` to respect the toggle



**Version:** 2.0.0
**Last update:** May 2026
