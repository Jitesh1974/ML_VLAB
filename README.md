# Linear Regression Lab (VLab)

An interactive, frontend-only virtual laboratory for learning **simple linear regression**. Built with React, Vite, and Recharts. It deploys as a static site on Vercel and does not need a server, database, API key, or external ML library.

## Features

- Linear regression calculated **from scratch** using ordinary least squares closed-form equations.
- Random dataset generation with positive, negative, weak-positive, and non-linear patterns.
- Controls for sample size and noise.
- Import a CSV file and choose any two numeric columns for X and Y.
- Manually add, edit, and delete observations in the dataset table.
- Live regression line and scatter plot.
- Interactive prediction for a selected X value.
- R-squared, MAE, RMSE, slope, intercept, and residual diagnostics.
- Residual scatter plot and CSV export of predictions/residuals.
- A learning tab showing equations and sums for the current dataset.
- Responsive layout for laptop, tablet, and mobile screens.

## Run locally

Install Node.js (LTS), then from this folder run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

Create a production build and test it locally:

```bash
npm run build
npm run preview
```

## Deploy on Vercel

### Option A — GitHub (recommended)

1. Create a GitHub repository and upload the contents of this folder to its root.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Vercel should detect Vite automatically. Use these settings if prompted:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Click **Deploy**. Future pushes to the connected branch will trigger new deployments.

### Option B — Vercel CLI

```bash
npm install
npm run build
npx vercel
```

Follow the CLI prompts. For a production deployment, run `npx vercel --prod`.

## CSV format

The first row must contain column headers. The file should have at least two numeric columns. For example:

```csv
Hours_Studied,Exam_Score
1,35
2,41
3,49
4,56
5,63
6,70
```

After import, use the X feature and Y target selectors to choose columns. Rows with non-numeric or missing values in either selected column are skipped. CSV parsing supports quoted cells and escaped quotes, but expects conventional comma-separated CSV (not semicolon-separated files).

## How the model is calculated

For `n` observations `(x_i, y_i)`, the slope and intercept are computed directly:

\[
 m = \frac{n\sum xy - (\sum x)(\sum y)}{n\sum x^2 - (\sum x)^2}
\]

\[
 b = \bar{y} - m\bar{x}, \qquad \hat{y} = mx+b
\]

No regression package is used. JavaScript calculates the sums, slope, intercept, predictions, residuals, MAE, RMSE, and R-squared. Recharts is used only to draw graphs.

## Notes

- Everything runs in the browser. An uploaded CSV is read locally and is not sent to a backend by this app.
- The app uses Google Fonts when internet access is available; system sans-serif fonts remain as fallbacks.
- This is an educational **simple linear regression** lab with one input feature X and one numeric target Y, not a multi-feature production model.
