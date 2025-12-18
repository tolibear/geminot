# PRD: Clean Asset Assistant (Badge Detector)

> **Version:** 1.0.0  
> **Last Updated:** 2025-12-18  
> **Status:** Draft

---

## 1. Executive Summary

**Clean Asset Assistant** is a privacy-first, client-side web application that detects attribution badges (sparkle marks) in images and guides users to obtain legitimate clean originals. The app does **NOT** remove badges—it helps users identify badged assets and provides clear remediation paths.

---

## 2. Background & Problem Statement

### 2.1 Context

Users frequently encounter images containing a small **bottom-right sparkle badge** (a four-point sparkle inside a circle). This occurs when:

- Images are exported with an attribution mark by the originating tool/service
- Users capture screenshots of image viewers that overlay badges
- Automated pipelines add badge layers during generation or publishing

### 2.2 Problem

Users need "clean" images for legitimate downstream use (marketing, documentation, portfolios), but:

- They don't know _why_ the badge is present
- They don't know how to obtain the **original, unbadged** file
- They waste time with manual trial-and-error

### 2.3 Product Opportunity

A lightweight web tool that:

- Accepts drag-and-drop uploads
- Automatically detects badges **client-side** (no server uploads)
- Provides actionable next steps to retrieve/replace with clean source assets
- Produces clean deliverables **only when user provides an authorized clean original**

---

## 3. Goals & Non-Goals

### 3.1 Goals

| ID  | Goal                                                                     |
| --- | ------------------------------------------------------------------------ |
| G1  | Frictionless upload experience (drag-and-drop, multi-file batch)         |
| G2  | High precision/recall badge detection in bottom-right region             |
| G3  | Clear remediation guidance to obtain legitimate clean images             |
| G4  | Fast replacement loop: upload → detect → swap clean original → download  |
| G5  | Privacy-forward: 100% client-side processing, no image uploads to server |

### 3.2 Non-Goals (Explicit)

| ID  | Non-Goal                                                  |
| --- | --------------------------------------------------------- |
| NG1 | ❌ Automatically removing/painting over/inpainting badges |
| NG2 | ❌ Providing watermark/attribution removal tooling        |
| NG3 | ❌ Hosting a public image gallery or sharing feed         |
| NG4 | ❌ Long-term cloud storage of user images                 |

---

## 4. Target Users & Use Cases

### 4.1 Personas

| Persona              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **Content Marketer** | Needs clean visuals for posts/pages; not deeply technical               |
| **Designer**         | Receives assets from multiple sources; needs quick QA checks            |
| **Ops/PM**           | Building documentation; wants to detect badged assets before publishing |
| **Creator**          | Exporting from tools/services; wants to learn correct export path       |

### 4.2 Primary Use Cases

| UC  | Description                                                                |
| --- | -------------------------------------------------------------------------- |
| UC1 | Upload images and identify which contain the badge                         |
| UC2 | Receive clear steps to obtain authorized clean original for flagged images |
| UC3 | Replace flagged images with clean versions and download them               |

### 4.3 Secondary Use Cases (Post-MVP)

| UC  | Description                                                       |
| --- | ----------------------------------------------------------------- |
| UC4 | Team workflow: "asset QA gate" before publishing                  |
| UC5 | Optional integrations to retrieve originals from approved sources |

---

## 5. User Experience & Flows

### 5.1 Landing Page

```
┌─────────────────────────────────────────────────────────────┐
│                    🔍 Clean Asset Assistant                 │
│                                                             │
│   Upload images. We'll detect bottom-right sparkle badges   │
│   and help you replace them with authorized clean originals │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │        📁 Drop images here or click to upload       │   │
│  │                                                     │   │
│  │              Supports: JPG, PNG, WEBP               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│              [How to avoid the badge →]                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Core Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│  1. Upload   │ -> │  2. Detect   │ -> │  3. Results      │
│  (Drag/Drop) │    │  (Client-    │    │  Grid            │
│              │    │   side)      │    │                  │
└──────────────┘    └──────────────┘    └──────────────────┘
                                               │
                    ┌──────────────────────────┴───────────────────────┐
                    ↓                                                  ↓
           ┌──────────────┐                               ┌──────────────────┐
           │ ✅ No Badge  │                               │ ⚠️ Badge Detected │
           │              │                               │                  │
           │ [Download]   │                               │ "What to do next"│
           │              │                               │ + [Upload        │
           └──────────────┘                               │    Replacement]  │
                                                          └──────────────────┘
                                                                   │
                                                                   ↓
                                                          ┌──────────────────┐
                                                          │ 4. Re-check      │
                                                          │ replacement      │
                                                          │ [Download Clean] │
                                                          └──────────────────┘
```

### 5.3 Results Grid States

| State                | Visual          | Action                             |
| -------------------- | --------------- | ---------------------------------- |
| Scanning...          | Spinner overlay | Wait                               |
| ✅ No badge detected | Green checkmark | Download                           |
| ⚠️ Badge detected    | Yellow warning  | View guidance + Upload replacement |
| ❌ Unsupported/Error | Red X           | Retry or skip                      |

### 5.4 Remediation Guidance Panel

When badge is detected, show:

> **This image contains an attribution badge.**
>
> The Clean Asset Assistant does not remove badges. Here's how to get a clean original:
>
> 1. **Download/export the original** — Avoid screenshots of viewers that overlay UI
> 2. **Re-export from source** — If you created the asset, re-export with badge/watermark disabled
> 3. **Use licensed version** — If from a service/library, use their official no-badge export path
>
> [Upload Clean Replacement]

---

## 6. Functional Requirements

### 6.1 Upload & File Handling

| ID  | Requirement                                             | Priority |
| --- | ------------------------------------------------------- | -------- |
| FR1 | Drag-and-drop upload zone + click-to-upload             | P0       |
| FR2 | Support multiple files in one session (batch)           | P0       |
| FR3 | Supported formats: JPG/JPEG, PNG, WEBP                  | P0       |
| FR4 | HEIC/HEIF support via client-side conversion            | P1       |
| FR5 | Max file size: 20MB per file (configurable)             | P0       |
| FR6 | Display thumbnails with filename, dimensions, file size | P0       |

### 6.2 Badge Detection

| ID   | Requirement                                            | Priority |
| ---- | ------------------------------------------------------ | -------- |
| FR7  | Run detection automatically after upload               | P0       |
| FR8  | Per-image result: `BadgeDetected`, `Confidence` (0-1)  | P0       |
| FR9  | Detection focused on bottom-right ROI (configurable %) | P0       |
| FR10 | Multi-scale template matching for resolution variance  | P0       |
| FR11 | Clear explanation when badge detected                  | P0       |
| FR12 | Search all corners (post-MVP configurable)             | P2       |

### 6.3 Replacement Workflow

| ID   | Requirement                                                   | Priority |
| ---- | ------------------------------------------------------------- | -------- |
| FR13 | Upload replacement mapped to original (by filename or manual) | P0       |
| FR14 | Side-by-side thumbnail comparison (original vs replacement)   | P1       |
| FR15 | Re-verify replacement is clean before allowing download       | P0       |

### 6.4 Download/Export

| ID   | Requirement                          | Priority |
| ---- | ------------------------------------ | -------- |
| FR16 | Download individual clean images     | P0       |
| FR17 | Download all clean images as ZIP     | P0       |
| FR18 | Preserve original format by default  | P0       |
| FR19 | Optional format conversion (PNG/JPG) | P2       |

### 6.5 Help & Compliance UX

| ID   | Requirement                                               | Priority |
| ---- | --------------------------------------------------------- | -------- |
| FR20 | Display explicit policy statement (no badge removal)      | P0       |
| FR21 | "How to avoid the badge" help content                     | P0       |
| FR22 | Confidence-based "Possible badge detected" for edge cases | P1       |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID   | Requirement       | Target                                       |
| ---- | ----------------- | -------------------------------------------- |
| NFR1 | Detection latency | ≤ 300ms per image (web-sized, modern laptop) |
| NFR2 | UI responsiveness | Non-blocking during batch processing         |
| NFR3 | Memory efficiency | Handle 20+ images without tab crash          |

### 7.2 Privacy & Security

| ID   | Requirement                                        |
| ---- | -------------------------------------------------- |
| NFR4 | 100% client-side processing by default             |
| NFR5 | No image data sent to any server                   |
| NFR6 | No third-party analytics collecting image contents |
| NFR7 | Clear privacy statement displayed                  |

### 7.3 Accessibility

| ID    | Requirement                                            |
| ----- | ------------------------------------------------------ |
| NFR8  | Keyboard accessible drop zone and controls             |
| NFR9  | ARIA labels and screen-reader friendly status messages |
| NFR10 | Sufficient color contrast for all states               |

### 7.4 Browser Support

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | 90+             |
| Firefox | 88+             |
| Safari  | 14+             |
| Edge    | 90+             |

---

## 8. Technical Architecture

### 8.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   React/Next.js  │    │  Web Worker      │                   │
│  │   UI Layer       │<-->│  (Detection)     │                   │
│  │                  │    │                  │                   │
│  │  - Dropzone      │    │  - OpenCV.js     │                   │
│  │  - Results Grid  │    │  - Template      │                   │
│  │  - Guidance      │    │    Matching      │                   │
│  │  - Downloads     │    │                  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       ↓                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Client-Side Storage                    │    │
│  │  - IndexedDB (optional: large file caching)             │    │
│  │  - In-memory (default: session-only)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Detection Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Load Image  │ -> │ Extract ROI │ -> │ Multi-Scale │ -> │ Confidence  │
│ to Canvas   │    │ (Bottom-    │    │ Template    │    │ Threshold   │
│             │    │  Right)     │    │ Match       │    │ Decision    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**ROI Configuration:**

- Default: Bottom-right 15% of image (width & height)
- Adjustable via settings for edge cases

**Template Matching:**

- Store reference badge template(s) at multiple scales
- Use OpenCV.js `matchTemplate()` with `TM_CCOEFF_NORMED`
- Build small image pyramid (3-5 scales) for resolution independence

---

## 9. Technology Stack (Researched & Recommended)

### 9.1 Frontend Framework

| Technology                  | Purpose    | Rationale                                            |
| --------------------------- | ---------- | ---------------------------------------------------- |
| **Next.js 14** (App Router) | Framework  | SSG for fast loads, excellent DX, TypeScript support |
| **React 18**                | UI Library | Component-based, large ecosystem                     |
| **TypeScript**              | Language   | Type safety, better tooling                          |

### 9.2 UI & Styling

| Technology        | Purpose           | Rationale                                                                |
| ----------------- | ----------------- | ------------------------------------------------------------------------ |
| **Tailwind CSS**  | Styling           | Utility-first, fast development, small bundle                            |
| **shadcn/ui**     | Component Library | Beautiful, accessible components (Dialog, Card, Button, Progress, Toast) |
| **Framer Motion** | Animations        | Smooth micro-interactions, drag feedback                                 |

### 9.3 File Upload & Handling

| Technology         | NPM Package      | Purpose                  | Rationale                                                               |
| ------------------ | ---------------- | ------------------------ | ----------------------------------------------------------------------- |
| **react-dropzone** | `react-dropzone` | Drag-and-drop upload     | Most popular (8M+ weekly downloads), flexible hooks API, excellent a11y |
| **heic2any**       | `heic2any`       | HEIC→JPEG/PNG conversion | Client-side HEIC support for iOS photos                                 |

**react-dropzone Example:**

```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  },
  maxSize: 20 * 1024 * 1024, // 20MB
  onDrop: (acceptedFiles) => processFiles(acceptedFiles),
});
```

### 9.4 Image Processing & Detection

| Technology      | NPM Package            | Purpose                              | Rationale                                                       |
| --------------- | ---------------------- | ------------------------------------ | --------------------------------------------------------------- |
| **OpenCV.js**   | `@techstark/opencv-js` | Template matching & image processing | Industry standard CV library, WASM-based, excellent performance |
| **Pixelmatch**  | `pixelmatch`           | Image comparison (optional)          | Lightweight alternative for simple comparisons                  |
| **Resemble.js** | `resemblejs`           | Visual diff (optional)               | Good for side-by-side comparison visualization                  |

**OpenCV.js Template Matching:**

```typescript
import cvReadyPromise from '@techstark/opencv-js';

async function detectBadge(
  imageData: ImageData,
  template: ImageData
): Promise<DetectionResult> {
  const cv = await cvReadyPromise;

  // Create matrices
  const src = cv.matFromImageData(imageData);
  const templ = cv.matFromImageData(template);
  const result = new cv.Mat();

  // Template matching
  cv.matchTemplate(src, templ, result, cv.TM_CCOEFF_NORMED);

  // Find best match
  const minMax = cv.minMaxLoc(result);
  const confidence = minMax.maxVal;

  // Cleanup
  src.delete();
  templ.delete();
  result.delete();

  return {
    detected: confidence > THRESHOLD,
    confidence,
    location: minMax.maxLoc,
  };
}
```

### 9.5 Download & Export

| Technology       | NPM Package  | Purpose             | Rationale                                       |
| ---------------- | ------------ | ------------------- | ----------------------------------------------- |
| **JSZip**        | `jszip`      | ZIP file generation | Client-side ZIP creation, 18M+ weekly downloads |
| **FileSaver.js** | `file-saver` | Browser downloads   | Reliable cross-browser file saving              |

**ZIP Generation Example:**

```typescript
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

async function downloadAllClean(files: ProcessedFile[]) {
  const zip = new JSZip();

  for (const file of files.filter((f) => !f.badgeDetected)) {
    zip.file(file.name, file.blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'clean-assets.zip');
}
```

### 9.6 Web Workers (Non-blocking Processing)

| Technology             | Purpose               | Rationale                                  |
| ---------------------- | --------------------- | ------------------------------------------ |
| **Comlink**            | Worker communication  | Simplifies Web Worker API with async/await |
| **Native Web Workers** | Background processing | Keep UI responsive during detection        |

**Worker Architecture:**

```typescript
// detection.worker.ts
import { expose } from 'comlink';
import cvReadyPromise from '@techstark/opencv-js';

const detectionAPI = {
  async detectBadge(imageData: ImageData): Promise<DetectionResult> {
    const cv = await cvReadyPromise;
    // ... detection logic
  },
};

expose(detectionAPI);

// main thread
import { wrap } from 'comlink';

const worker = new Worker(new URL('./detection.worker.ts', import.meta.url));
const detection = wrap<typeof detectionAPI>(worker);

const result = await detection.detectBadge(imageData);
```

### 9.7 State Management

| Technology                 | Purpose      | Rationale                                    |
| -------------------------- | ------------ | -------------------------------------------- |
| **Zustand**                | Global state | Minimal, TypeScript-friendly, no boilerplate |
| **React Query (optional)** | Async state  | If any API calls needed in future            |

### 9.8 Development & Quality

| Technology              | Purpose          |
| ----------------------- | ---------------- |
| **Vitest**              | Unit testing     |
| **Playwright**          | E2E testing      |
| **ESLint + Prettier**   | Code quality     |
| **Husky + lint-staged** | Pre-commit hooks |

---

## 10. Package.json Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@techstark/opencv-js": "^4.10.0",
    "react-dropzone": "^14.2.0",
    "jszip": "^3.10.1",
    "file-saver": "^2.0.5",
    "heic2any": "^0.0.4",
    "comlink": "^4.4.1",
    "zustand": "^4.4.0",
    "framer-motion": "^10.16.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.292.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^3.3.0",
    "@types/file-saver": "^2.0.7",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "eslint": "^8.54.0",
    "prettier": "^3.1.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.1.0"
  }
}
```

---

## 11. Detection Algorithm Details

### 11.1 Template Preparation

Store reference badge templates as base64 or PNG files:

- Multiple sizes (16px, 24px, 32px, 48px, 64px)
- Variations if badge has known variants
- Grayscale versions for faster matching

### 11.2 Detection Pipeline

```typescript
interface DetectionConfig {
  roiPercent: number; // 0.15 = bottom-right 15%
  confidenceThreshold: number; // 0.7 for "detected", 0.5 for "possible"
  scales: number[]; // [0.5, 0.75, 1.0, 1.25, 1.5]
  templatePath: string;
}

interface DetectionResult {
  detected: boolean;
  confidence: number;
  possibleDetection: boolean; // confidence between 0.5-0.7
  location?: { x: number; y: number };
}
```

### 11.3 Confidence Thresholds

| Confidence  | Status         | UI Feedback                      |
| ----------- | -------------- | -------------------------------- |
| ≥ 0.70      | Badge Detected | Yellow warning, show remediation |
| 0.50 - 0.69 | Possible Badge | "Review recommended" state       |
| < 0.50      | No Badge       | Green checkmark, allow download  |

---

## 12. Edge Cases & Handling

| Edge Case                  | Detection Behavior   | UX Handling                                  |
| -------------------------- | -------------------- | -------------------------------------------- |
| Badge partially cropped    | Lower confidence     | "Possible badge detected" state              |
| Badge in different corner  | Not detected (MVP)   | Configurable corner search (v2)              |
| Pink annotation circles    | Should not trigger   | Focus template on sparkle shape specifically |
| Transparent PNG            | Handle alpha channel | Composite on white before matching           |
| Very small images (<100px) | Skip ROI, full scan  | Show "insufficient resolution" warning       |
| Corrupted/invalid files    | Decode failure       | Clear error message, skip file               |

---

## 13. Success Metrics

### 13.1 Product Metrics

| Metric | Definition                      | Target                 |
| ------ | ------------------------------- | ---------------------- |
| M1     | Images uploaded per session     | 5+ avg                 |
| M2     | % images flagged with badge     | Track baseline         |
| M3     | Replacement completion rate     | >60% of flagged images |
| M4     | Time-to-clean-download          | <30s median            |
| M5     | User-reported accuracy (thumbs) | >90% positive          |

### 13.2 Quality Metrics

| Metric              | Definition                 | Target |
| ------------------- | -------------------------- | ------ |
| Precision           | True positives / (TP + FP) | >95%   |
| Recall              | True positives / (TP + FN) | >90%   |
| False positive rate | FP / (FP + TN)             | <1%    |

---

## 14. Implementation Phases (Complete Build-Out)

### Overview Timeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PHASE 0       PHASE 1       PHASE 2       PHASE 3       PHASE 4      PHASE 5│
│  Foundation    Core Upload   Detection     Results &     Polish &     Launch │
│  (2 days)      (3 days)      Engine        Downloads     UX           Ready  │
│                              (4 days)      (3 days)      (3 days)     (2 days)│
├──────────────────────────────────────────────────────────────────────────────┤
│  Day 1-2       Day 3-5       Day 6-9       Day 10-12     Day 13-15    Day 16-17│
└──────────────────────────────────────────────────────────────────────────────┘
                         Total: ~17 working days (3.5 weeks)
```

---

### Phase 0: Foundation Setup (Days 1-2)

**Goal:** Project scaffolding with all tooling configured and ready.

#### Tasks

| #    | Task                                          | Est. | Deliverable                       |
| ---- | --------------------------------------------- | ---- | --------------------------------- |
| 0.1  | Initialize Next.js 14 project with TypeScript | 1h   | `npx create-next-app@latest`      |
| 0.2  | Configure Tailwind CSS + CSS variables        | 30m  | `tailwind.config.ts`              |
| 0.3  | Install and configure shadcn/ui               | 1h   | `components/ui/*` base components |
| 0.4  | Set up project structure (folders, aliases)   | 30m  | Organized `/src` structure        |
| 0.5  | Configure ESLint + Prettier + Husky           | 1h   | Pre-commit hooks working          |
| 0.6  | Set up Vitest for unit testing                | 30m  | `vitest.config.ts`                |
| 0.7  | Create Zod schemas for core data types        | 1h   | `lib/schemas.ts`                  |
| 0.8  | Set up centralized logger utility             | 30m  | `lib/logger.ts`                   |
| 0.9  | Create custom error classes                   | 30m  | `lib/errors.ts`                   |
| 0.10 | Environment variable validation               | 30m  | `lib/env.ts`                      |
| 0.11 | Create constants file                         | 30m  | `lib/constants.ts`                |
| 0.12 | Design system tokens (colors, spacing)        | 1h   | CSS variables, theme              |

#### Project Structure Created

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── progress.tsx
│   │   └── toast.tsx
│   └── ...                    # App components (later)
├── lib/
│   ├── constants.ts           # App constants
│   ├── env.ts                 # Environment validation
│   ├── errors.ts              # Custom error classes
│   ├── logger.ts              # Logging utility
│   ├── schemas.ts             # Zod schemas
│   └── utils.ts               # Utility functions
├── hooks/                     # Custom React hooks
├── stores/                    # Zustand stores
├── workers/                   # Web Workers
└── types/                     # TypeScript types
```

#### Acceptance Criteria

- [ ] `npm run dev` starts without errors
- [ ] `npm run lint` passes
- [ ] `npm run test` runs (no tests yet, but configured)
- [ ] shadcn/ui Button renders correctly
- [ ] Tailwind classes apply styling
- [ ] Pre-commit hook blocks commits with lint errors

---

### Phase 1: Core Upload Experience (Days 3-5)

**Goal:** Beautiful, functional drag-and-drop upload with file preview.

#### Tasks

| #    | Task                                   | Est. | Deliverable                       |
| ---- | -------------------------------------- | ---- | --------------------------------- |
| 1.1  | Install react-dropzone                 | 15m  | Package installed                 |
| 1.2  | Create `FileUploader` component        | 2h   | Drop zone with visual states      |
| 1.3  | Implement file validation (type, size) | 1h   | Validation logic + error display  |
| 1.4  | Create `ImageThumbnail` component      | 2h   | Canvas-based thumbnail generation |
| 1.5  | Create `FileGrid` component            | 2h   | Responsive grid layout            |
| 1.6  | Implement Zustand store for files      | 1.5h | `stores/file-store.ts`            |
| 1.7  | Add file metadata display              | 1h   | Name, size, dimensions            |
| 1.8  | Create drag-active visual feedback     | 1h   | Animations, border states         |
| 1.9  | Implement multi-file selection         | 1h   | Batch upload support              |
| 1.10 | Add file removal functionality         | 30m  | X button on thumbnails            |
| 1.11 | Create landing page layout             | 2h   | Hero, upload area, footer         |
| 1.12 | Add loading skeleton states            | 1h   | Placeholder UI while loading      |

#### Components Created

```typescript
// components/upload/FileUploader.tsx
interface FileUploaderProps {
  onFilesAccepted: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
}

// components/upload/ImageThumbnail.tsx
interface ImageThumbnailProps {
  file: ProcessedFile;
  onRemove: () => void;
  status: 'pending' | 'scanning' | 'clean' | 'badge' | 'error';
}

// components/upload/FileGrid.tsx
interface FileGridProps {
  files: ProcessedFile[];
  onRemoveFile: (id: string) => void;
}
```

#### Zustand Store Schema

```typescript
// stores/file-store.ts
interface FileState {
  files: ProcessedFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileStatus) => void;
  clearFiles: () => void;
}

interface ProcessedFile {
  id: string;
  originalFile: File;
  name: string;
  size: number;
  dimensions: { width: number; height: number };
  thumbnailUrl: string;
  status: FileStatus;
  detectionResult?: DetectionResult;
  replacementFile?: ProcessedFile;
}
```

#### Acceptance Criteria

- [ ] Can drag files onto drop zone
- [ ] Can click to select files
- [ ] Shows thumbnails in responsive grid
- [ ] Displays file metadata (name, size, dimensions)
- [ ] Rejects invalid file types with clear message
- [ ] Rejects files over size limit with message
- [ ] Can remove individual files
- [ ] Visual feedback during drag-over
- [ ] Works with 10+ files without performance issues

---

### Phase 2: Detection Engine (Days 6-9)

**Goal:** Reliable badge detection running in Web Worker.

#### Tasks

| #    | Task                                     | Est. | Deliverable                   |
| ---- | ---------------------------------------- | ---- | ----------------------------- |
| 2.1  | Install OpenCV.js (@techstark/opencv-js) | 30m  | Package + types               |
| 2.2  | Create badge template assets             | 2h   | Multi-scale PNG templates     |
| 2.3  | Implement Web Worker setup               | 2h   | Worker + Comlink wrapper      |
| 2.4  | Create detection service                 | 3h   | Template matching logic       |
| 2.5  | Implement ROI extraction                 | 1.5h | Bottom-right region crop      |
| 2.6  | Implement multi-scale matching           | 2h   | Pyramid search                |
| 2.7  | Add confidence scoring                   | 1h   | Normalized match scores       |
| 2.8  | Create detection queue manager           | 2h   | Process files sequentially    |
| 2.9  | Implement progress reporting             | 1h   | Worker → main thread updates  |
| 2.10 | Add detection caching                    | 1h   | Avoid re-processing same file |
| 2.11 | Write unit tests for detection           | 2h   | Test with sample images       |
| 2.12 | Performance optimization                 | 2h   | Memory cleanup, lazy loading  |

#### Web Worker Architecture

```typescript
// workers/detection.worker.ts
import { expose } from 'comlink';
import cvReadyPromise from '@techstark/opencv-js';

interface DetectionAPI {
  initialize(): Promise<void>;
  detectBadge(imageData: ImageData): Promise<DetectionResult>;
  setConfig(config: DetectionConfig): void;
}

// lib/services/detection-service.ts
class DetectionService {
  private worker: Remote<DetectionAPI>;

  async processFile(file: ProcessedFile): Promise<DetectionResult>;
  async processQueue(files: ProcessedFile[]): AsyncGenerator<DetectionProgress>;
}
```

#### Detection Config

```typescript
// lib/constants.ts
export const DETECTION_CONFIG = {
  ROI_PERCENT: 0.15, // Bottom-right 15%
  CONFIDENCE_THRESHOLD: 0.7, // "Detected" threshold
  POSSIBLE_THRESHOLD: 0.5, // "Possible" threshold
  SCALES: [0.5, 0.75, 1.0, 1.25, 1.5],
  MATCH_METHOD: 'TM_CCOEFF_NORMED',
  MAX_CONCURRENT: 1, // Sequential to avoid memory issues
} as const;
```

#### Acceptance Criteria

- [ ] OpenCV.js loads successfully in worker
- [ ] Detection runs without blocking UI
- [ ] Badge detected in test images with >0.7 confidence
- [ ] Clean images return <0.5 confidence
- [ ] Progress updates during batch processing
- [ ] Memory usage stays stable during batch
- [ ] Detection completes in <500ms per image
- [ ] Worker error handling doesn't crash app

---

### Phase 3: Results & Downloads (Days 10-12)

**Goal:** Complete results UI, remediation flow, and export functionality.

#### Tasks

| #    | Task                                  | Est. | Deliverable                       |
| ---- | ------------------------------------- | ---- | --------------------------------- |
| 3.1  | Create `ResultsGrid` component        | 2h   | Grid with status indicators       |
| 3.2  | Create status badge components        | 1h   | Clean/Badge/Possible/Error states |
| 3.3  | Create `RemediationPanel` component   | 2h   | Guidance content + actions        |
| 3.4  | Implement file replacement flow       | 2h   | Upload replacement for flagged    |
| 3.5  | Create side-by-side comparison        | 1.5h | Original vs replacement view      |
| 3.6  | Install JSZip + FileSaver.js          | 15m  | Packages installed                |
| 3.7  | Implement individual download         | 1h   | Single file download              |
| 3.8  | Implement ZIP download                | 2h   | Batch export clean files          |
| 3.9  | Create `DownloadPanel` component      | 1.5h | Download actions UI               |
| 3.10 | Add download progress indicator       | 1h   | ZIP generation progress           |
| 3.11 | Implement file name conflict handling | 1h   | Append suffix for dupes           |
| 3.12 | Add toast notifications               | 1h   | Success/error feedback            |

#### Components Created

```typescript
// components/results/ResultsGrid.tsx
interface ResultsGridProps {
  files: ProcessedFile[];
  onReplace: (fileId: string) => void;
  onDownload: (fileId: string) => void;
}

// components/results/RemediationPanel.tsx
interface RemediationPanelProps {
  file: ProcessedFile;
  onUploadReplacement: (file: File) => void;
  onDismiss: () => void;
}

// components/results/DownloadPanel.tsx
interface DownloadPanelProps {
  cleanFiles: ProcessedFile[];
  onDownloadAll: () => void;
  onDownloadSingle: (fileId: string) => void;
}
```

#### Download Service

```typescript
// lib/services/download-service.ts
class DownloadService {
  async downloadSingle(file: ProcessedFile): Promise<void>;
  async downloadAllClean(files: ProcessedFile[]): Promise<void>;
  async generateZip(files: ProcessedFile[]): Promise<Blob>;
}
```

#### Acceptance Criteria

- [ ] Results grid shows all uploaded files with status
- [ ] Clean files have green checkmark
- [ ] Badge files have yellow warning
- [ ] Clicking badge file shows remediation panel
- [ ] Can upload replacement for flagged file
- [ ] Replacement gets re-scanned automatically
- [ ] Side-by-side comparison shows both versions
- [ ] Can download individual clean files
- [ ] Can download all clean files as ZIP
- [ ] ZIP excludes files with badges
- [ ] Toast shows on successful download
- [ ] Toast shows on errors

---

### Phase 4: Polish & UX Enhancement (Days 13-15)

**Goal:** Production-ready experience with excellent UX.

#### Tasks

| #    | Task                                | Est. | Deliverable                     |
| ---- | ----------------------------------- | ---- | ------------------------------- |
| 4.1  | Implement keyboard shortcuts        | 1.5h | Ctrl+V paste, Delete, etc.      |
| 4.2  | Add keyboard navigation             | 1.5h | Tab through grid, Enter to act  |
| 4.3  | Implement HEIC support (heic2any)   | 2h   | iOS photo compatibility         |
| 4.4  | Create "How to avoid badges" page   | 2h   | Help content page               |
| 4.5  | Add empty state illustrations       | 1h   | No files uploaded state         |
| 4.6  | Implement dark mode toggle          | 1.5h | Theme switcher                  |
| 4.7  | Add animations (Framer Motion)      | 2h   | Entrance, exit, drag animations |
| 4.8  | Optimize bundle size                | 2h   | Code splitting, lazy loading    |
| 4.9  | Add analytics events (privacy-safe) | 1h   | Counts only, no image data      |
| 4.10 | Implement error boundaries          | 1h   | Graceful crash handling         |
| 4.11 | Add loading states everywhere       | 1h   | Consistent skeleton/spinner     |
| 4.12 | Mobile responsive polish            | 2h   | Touch-friendly, responsive      |

#### Keyboard Shortcuts

| Shortcut               | Action                     |
| ---------------------- | -------------------------- |
| `Ctrl/Cmd + V`         | Paste image from clipboard |
| `Delete` / `Backspace` | Remove selected file       |
| `Ctrl/Cmd + A`         | Select all files           |
| `Ctrl/Cmd + Shift + D` | Download all clean         |
| `Escape`               | Close modal/panel          |
| `Tab`                  | Navigate between files     |
| `Enter`                | Open selected file details |

#### Acceptance Criteria

- [ ] All keyboard shortcuts work
- [ ] Tab navigation is logical
- [ ] HEIC files convert and process correctly
- [ ] Help page is accessible and clear
- [ ] Dark mode works throughout app
- [ ] Animations feel smooth (60fps)
- [ ] Bundle size < 500KB (excluding OpenCV WASM)
- [ ] OpenCV WASM loads lazily on first detection
- [ ] Error boundary catches crashes gracefully
- [ ] All states have loading indicators
- [ ] Works well on mobile (touch, responsive)

---

### Phase 5: Launch Readiness (Days 16-17)

**Goal:** Production deployment and documentation.

#### Tasks

| #    | Task                           | Est. | Deliverable                |
| ---- | ------------------------------ | ---- | -------------------------- |
| 5.1  | Write E2E tests (Playwright)   | 3h   | Critical path coverage     |
| 5.2  | Performance audit (Lighthouse) | 1h   | 90+ scores                 |
| 5.3  | Accessibility audit (axe)      | 1h   | WCAG 2.1 AA compliance     |
| 5.4  | Security headers configuration | 1h   | CSP, HSTS, etc.            |
| 5.5  | Create favicon + OG images     | 1h   | Branding assets            |
| 5.6  | SEO meta tags                  | 30m  | Title, description, etc.   |
| 5.7  | Privacy policy page            | 1h   | Client-side only statement |
| 5.8  | 404 and error pages            | 1h   | Custom error pages         |
| 5.9  | Vercel deployment config       | 30m  | `vercel.json`              |
| 5.10 | Final QA pass                  | 2h   | Manual testing checklist   |
| 5.11 | Create demo video/GIF          | 1h   | Marketing asset            |
| 5.12 | Write README for repo          | 1h   | Setup instructions         |

#### E2E Test Scenarios

```typescript
// e2e/upload-flow.spec.ts
test('complete upload and download flow', async ({ page }) => {
  // 1. Navigate to app
  // 2. Upload test images (mix of clean and badged)
  // 3. Wait for detection to complete
  // 4. Verify correct status on each image
  // 5. Replace a badged image
  // 6. Download all clean as ZIP
  // 7. Verify ZIP contains expected files
});
```

#### Lighthouse Targets

| Metric         | Target |
| -------------- | ------ |
| Performance    | 90+    |
| Accessibility  | 100    |
| Best Practices | 100    |
| SEO            | 100    |

#### Acceptance Criteria

- [ ] E2E tests pass in CI
- [ ] Lighthouse scores meet targets
- [ ] No accessibility violations (axe)
- [ ] CSP headers configured correctly
- [ ] Favicon appears in browser tab
- [ ] OG image shows when sharing URL
- [ ] 404 page matches app design
- [ ] Deploys successfully to Vercel
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] README has clear setup instructions

---

### Phase 6: Post-Launch Enhancements (Future)

**Goal:** Iterative improvements based on usage.

#### Backlog Items

| Priority | Item                                             | Est. |
| -------- | ------------------------------------------------ | ---- |
| P1       | Detection accuracy improvements (more templates) | 2d   |
| P1       | User feedback mechanism (thumbs up/down)         | 1d   |
| P2       | Configurable ROI settings UI                     | 1d   |
| P2       | Detection in all corners (toggle)                | 1d   |
| P2       | Batch rename on download                         | 0.5d |
| P3       | PWA support (offline mode)                       | 2d   |
| P3       | Team sharing (shareable session links)           | 3d   |
| P3       | API for programmatic access                      | 3d   |
| P4       | Browser extension                                | 5d   |
| P4       | Slack/Discord integration                        | 2d   |

---

### Summary: Complete Build Checklist

#### Phase 0: Foundation ✓

- [ ] Next.js + TypeScript setup
- [ ] Tailwind + shadcn/ui
- [ ] Tooling (ESLint, Prettier, Husky, Vitest)
- [ ] Project structure + utilities

#### Phase 1: Upload ✓

- [ ] Drag-and-drop with react-dropzone
- [ ] File validation
- [ ] Thumbnail generation
- [ ] Zustand state management
- [ ] Responsive grid layout

#### Phase 2: Detection ✓

- [ ] OpenCV.js integration
- [ ] Web Worker setup
- [ ] Template matching
- [ ] Multi-scale detection
- [ ] Progress reporting

#### Phase 3: Results ✓

- [ ] Results grid with status
- [ ] Remediation guidance
- [ ] Replacement flow
- [ ] JSZip download
- [ ] Toast notifications

#### Phase 4: Polish ✓

- [ ] Keyboard shortcuts
- [ ] HEIC support
- [ ] Dark mode
- [ ] Animations
- [ ] Mobile responsive

#### Phase 5: Launch ✓

- [ ] E2E tests
- [ ] Performance audit
- [ ] Accessibility audit
- [ ] Security headers
- [ ] Deployment

---

## 15. Open Questions

| #   | Question                                                 | Status                    |
| --- | -------------------------------------------------------- | ------------------------- |
| 1   | Is the badge always identical (shape, opacity, color)?   | Needs sample analysis     |
| 2   | What % of images are expected to have badges?            | Needs baseline data       |
| 3   | Do users mostly upload single images or batches?         | Needs user research       |
| 4   | Are there known badge variants from different sources?   | Needs investigation       |
| 5   | Is client-side-only sufficient for large images (>10MB)? | Needs performance testing |

---

## 16. Risks & Mitigations

| Risk                            | Impact | Likelihood | Mitigation                                              |
| ------------------------------- | ------ | ---------- | ------------------------------------------------------- |
| Users expect automatic removal  | High   | High       | Clear messaging, replacement-first UX, explicit policy  |
| False positives frustrate users | Medium | Medium     | Confidence thresholds, "review" state, feedback loop    |
| OpenCV.js bundle too large      | Medium | Medium     | Lazy loading, code splitting, WASM streaming            |
| Performance issues on mobile    | Medium | Medium     | Web Workers, progressive enhancement, batch limits      |
| Badge variants reduce accuracy  | Medium | Low        | Template library, user feedback, continuous improvement |

---

## 17. Security Considerations

| Consideration                | Implementation                          |
| ---------------------------- | --------------------------------------- |
| No server uploads            | All processing in-browser with Web APIs |
| No external network requests | App works offline after initial load    |
| No analytics on images       | Only aggregate metrics (counts, timing) |
| CSP headers                  | Strict Content Security Policy          |
| No local storage of images   | Session-only, cleared on tab close      |

---

## 18. Appendix

### A. Library Comparison Matrix

| Library       | Use Case      | Bundle Size | Browser Support | Notes                            |
| ------------- | ------------- | ----------- | --------------- | -------------------------------- |
| OpenCV.js     | CV operations | ~8MB (WASM) | Modern browsers | Industry standard, comprehensive |
| Pixelmatch    | Simple diff   | ~3KB        | All             | Fast, limited features           |
| Resemble.js   | Visual diff   | ~15KB       | All             | Good UX, moderate features       |
| TensorFlow.js | ML detection  | ~1MB+       | Modern          | Overkill for template matching   |

### B. Alternative Detection Approaches

1. **Pure Canvas API** - Simpler but less robust
2. **TensorFlow.js + Custom Model** - Powerful but requires training data
3. **SSIM/PSNR comparison** - Good for known exact templates
4. **Feature matching (ORB/SIFT)** - Scale/rotation invariant but slower

**Recommendation:** OpenCV.js template matching offers the best balance of robustness, performance, and implementation complexity for this use case.

### C. Reference Badge Template Requirements

For optimal detection, badge templates should:

- Be captured at native resolution from known sources
- Include variants (if any) at different opacities
- Be stored in PNG format with transparency
- Include bounding box metadata for precise matching

---

_Document End_
