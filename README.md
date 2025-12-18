# Clean Asset Assistant (Geminot)

A privacy-first, client-side web application that detects attribution badges (sparkle marks) in images and guides users to obtain legitimate clean originals.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm test
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── globals.css        # Global styles with CSS variables
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── constants.ts       # App constants
│   ├── env.ts             # Environment validation
│   ├── errors.ts          # Custom error classes
│   ├── logger.ts          # Centralized logging
│   ├── schemas.ts         # Zod schemas
│   └── utils.ts           # Utility functions
├── hooks/                 # Custom React hooks
├── stores/                # Zustand stores
├── workers/               # Web Workers
└── types/                 # TypeScript types
```

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library
- **Code Quality**: ESLint + Prettier + Husky

## ✅ Phase 0 Complete

- [x] Next.js 14 project initialized
- [x] Tailwind CSS configured
- [x] shadcn/ui components installed
- [x] Quality tooling set up (Prettier, Husky, lint-staged, Vitest)
- [x] Core utilities created (logger, errors, env, constants, schemas)
- [x] Landing page shell created

## 🔒 Privacy

All image processing happens client-side. Your images never leave your device.

## 📝 License

MIT
