# pixel Glyph Ocr

An in-browser text extraction tool built around HTML5 Canvas pixel analysis. Upload an image, run localized binarization, segment distinct pixel clusters, and extract typed characters against pixel-mapped font matrices—all executed directly inside the client engine without network requests.

## Overview

Most optical character recognition setups rely on heavy backend engines or massive WebAssembly binaries. This project takes the opposite route: zero external libraries, pure DOM APIs, and fundamental computer vision logic written by hand. 

By analyzing color channel values across an HTML5 Canvas context, the script applies an adaptive Otsu threshold to separate foreground ink from background pixels. It then scans the canvas for connected regions, groups those regions into structured lines, normalizes each character box down to a $5 \times 7$ grid, and evaluates standard distance scores against predefined character masks.

## How It Works

```text
+------------------+     +--------------------+     +-----------------------+
|  Input Image     | --> | Otsu Binarization  | --> | Connected-Component   |
| (Local File API) |     | & Threshold Tuning |     | Labeling (8-Way BFS)   |
+------------------+     +--------------------+     +-----------------------+
|
+------------------+     +--------------------+                 v
| Extracted Text   | <-- | 5x7 Dot-Matrix     | <-- +-----------------------+
| (.txt Export)    |     | Glyph Matching     |     | Line Grouping &       |
+------------------+     +--------------------+     | Spatial Bounding      |
                                                    +-----------------------+
```

1. **Grayscale & Binarization**: The source image renders onto an offscreen canvas. Luminance values get calculated per pixel ($0.299R + 0.587G + 0.114B$). An automated Otsu threshold split finds the optimal midpoint between dark ink and bright paper, with a manual UI slider for fine-tuning.
2. **Connected-Component Labeling**: An 8-way flood-fill search traverses non-zero ink pixels, forming isolated bounding boxes around every candidate glyph while filtering out micro-noise artifacts.
3. **Line Grouping & Sorting**: Bounding boxes are sorted by vertical centers. Regions residing within a fractional height threshold are grouped into coherent text lines, then ordered left-to-right.
4. **Glyph Pattern Matching**: Every candidate box is mapped onto a $5 \times 7$ binary matrix grid. The generated bitmask compares against hardcoded $5 \times 7$ glyph templates using direct bit-difference scoring to return the closest alphanumeric match.

## Key Features

* **Client-Side Processing**: Files are processed locally on the DOM loop. No network latency, no server infrastructure, complete user privacy.
* **Otsu Auto-Thresholding**: Automatic calculation of bimodal pixel intensity histograms to handle uneven lighting.
* **Interactive Canvas Pipeline**: Live visual previews of original source images alongside binarized outputs with real-time bounding box overlays.
* **Light/Dark Text Support**: Toggle inversion logic to extract inverted color layouts effortlessly.
* **Plaintext Export**: Download parsed text output directly to `.txt` files through dynamically generated browser Blob objects.

## Tech Stack Breakdown

* **HTML5 Canvas API**: Context extraction (`getImageData`, `putImageData`) and pixel-array manipulation.
* **Vanilla JavaScript (ES6+)**: Custom flood-fill iterative stacks, matrix transformations, distance calculation routines, and DOM event wiring.
* **CSS3**: Flexible UI layouts using flexbox containers and CSS custom property styling.

## Prerequisites & Web-Based Quick Start

Since this project consists of client-side assets, you do not need local build systems or runtime installations like Node.js.

### Option A: Running via GitHub Codespaces

1. Press `.` on your keyboard while viewing this repository on GitHub to launch the web-based editor.
2. Open `index.html`.
3. Click **Go Live** or install the **Live Preview** extension inside the editor sidebar to launch an in-browser preview port.

### Option B: Local Browser Execution

1. Clone or download this repository.
2. Open `index.html` directly in modern desktop browsers (Chrome, Firefox, Safari, Edge).

## Project Structure

```text
pixel-glyph-ocr/
├── .github/
│   └── workflows/
│       └── static-analysis.yml  # HTML/CSS/JS syntax validation
├── .gitignore                   # Standard web repository rules
├── LICENSE                      # MIT License terms
├── README.md                    # Core project documentation
├── index.html                   # Primary application interface
├── script.js                    # OCR pipeline engine and DOM controls
└── style.css                    # Dark layout styling rules
```

## Roadmap

[ ] Add automated image rotation deskew using Hough Transform calculations.

[ ] Support dynamic grid scaling for varying font aspect ratios beyond fixed $5 \times 7$ layouts.

[ ] Expand glyph dictionary to cover basic punctuation marks and lower-case character sets.
