# PDF Splitter & Renamer Pro (Android & Web)

A powerful, mobile-friendly Android & Web app specifically built to split large PDF documents (e.g., 100 pages into 5 parts of 20 pages each) with custom naming, page index offset (e.g., starting at page 5 and counting it as page 1), and instant ZIP/single downloads.

---

## 🚀 Key Features

1. **Upload & Instant Analysis**:
   - Upload any size PDF directly on your phone or PC.
   - 100% private and offline: files are processed entirely in memory via `pdf-lib` without uploading to any remote server.
   - Shows total page count and file size instantly.

2. **Custom Split Options**:
   - **Equal Chunks**: Break into fixed sizes (e.g., 20 pages each -> 5 parts for 100 pages).
   - **Quick Presets**: 10, 20, 25, 50 pages buttons.
   - **Custom Page Ranges**: Support for custom ranges like `5-25, 26-50, 51-100`.

3. **Start Page Offset (Special Requirement)**:
   - Example: Start splitting from **Page 5** (skipping cover, index, contents).
   - **"Treat Start Page as Page 1"**: When turned on, Page 5 is counted as Page 1 in file names (`p1-20`, `p21-40`), while correctly extracting physical pages 5 to 24, 25 to 44, etc.

4. **Smart Dynamic Naming**:
   - **By Part Number**: `{book}_Part_1.pdf`, `{book}_Part_2.pdf`
   - **By Page Range**: `{book}_Pages_1-20.pdf`, `{book}_Pages_21-40.pdf`
   - **By Part + Page Range**: `{book}_Part_1_p1-20.pdf`
   - **Custom Formula**: Enter custom patterns with chips like `{book}`, `{part}`, `{start}`, `{end}`, `{total_parts}`, `{pages}`.
   - **Leading Zeroes**: Option to generate `Part_01`, `Part_02` instead of `Part_1`.

5. **Download Options**:
   - **Download All as ZIP**: Splits all parts and bundles them into one `.zip` archive for easy 1-click download.
   - **Individual Download**: Download any specific part separately.

---

## 📱 How to Use on Android Phone

### Method 1: Instant PWA Install (No APK build needed, works in 10 seconds)
1. Run the local server:
   ```bash
   npm run dev
   ```
2. Terminal me aapko Network IP dikhegi (jaise `http://192.168.1.X:3000`).
3. Apne Android phone ke Google Chrome browser me ye URL open karein (phone aur PC same Wi-Fi pe hone chahiye).
4. Chrome ke 3-dots menu par tap karein aur **"Install app"** ya **"Add to Home screen"** select karein.
5. App aapke phone me standalone Android app ban kar install ho jayegi aur bina internet ke bhi offline chalegi!

---

### Method 2: Free 1-Click APK Build via GitHub Actions
Aapke project me `.github/workflows/build-apk.yml` file ready hai:
1. Is folder ko apne GitHub repository me push karein.
2. GitHub repository me **Actions** tab par jayein -> **Build Android APK** workflow select karke **Run workflow** click karein.
3. 2 se 3 minute me GitHub free me `app-debug.apk` compile kar dega!
4. **Artifacts** section se `.apk` file direct download karke apne phone me install kar sakte hain.

---

### Method 3: Local Android Studio Build
Agar aapke paas Android Studio installed hai:
```bash
npm run build
npx cap sync android
npm run cap:open
```
Android Studio me **Build > Build Bundle(s) / APK(s) > Build APK(s)** click karein.

---

## 💻 Python CLI Utility (Bonus)
Aap terminal se direct bina UI ke bhi split kar sakte hain:
```bash
pip install pypdf
python pdf_splitter.py
```
