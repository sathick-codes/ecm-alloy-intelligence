# AI-Driven Alloy Intelligence & ECM Parameter Prediction Web App

Built for **MEDX55 | Advanced Machining Process** (Department of Mechanical Engineering, B.S. Abdur Rahman Crescent Institute of Science and Technology).

## Quick Start in Google Antigravity -> GitHub -> Vercel

1. **Unzip this folder** on your computer (`ecm-alloy-intelligence-web`).
2. **Open in Google Antigravity**:
   - Launch Antigravity IDE -> **Projects -> Open Project / Create New Project** -> select the `ecm-alloy-intelligence-web` folder.
   - Open the integrated terminal (or ask the Antigravity agent) and run:
     ```bash
     npm install
     npm run dev
     ```
   - Open `http://localhost:5173` and test both Single Material and Alloy modes.
3. **Push to GitHub**:
   - Create a new empty repository on GitHub (e.g., `ecm-alloy-intelligence`).
   - Run in Antigravity terminal:
     ```bash
     git init
     git add .
     git commit -m "Initial ECM Alloy Intelligence web app"
     git branch -M main
     git remote add origin https://github.com/<YOUR-USERNAME>/ecm-alloy-intelligence.git
     git push -u origin main
     ```
4. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com), click **Add New -> Project**, and import your `ecm-alloy-intelligence` GitHub repository.
   - Vercel automatically detects **Vite** (`npm run build`, output directory `dist`).
   - Click **Deploy** to get your live HTTPS URL.

## Adding More Research Papers
Add new verified experimental rows directly to `src/data/ecmLiteratureDataset.js` inside `ECM_LITERATURE_RECORDS`, commit, and push to GitHub—Vercel automatically rebuilds and updates your live website.
