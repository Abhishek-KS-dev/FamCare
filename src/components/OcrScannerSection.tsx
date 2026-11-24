import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileSearch,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createWorker } from 'tesseract.js';
import { api, type AgentAnalysisReport, type FamilyMemberRecord } from '../services/api.ts';
import { parseOcrLabelText } from '../utils/ocrParser.ts';

interface OcrScannerSectionProps {
  selectedMember: FamilyMemberRecord | null;
  onAnalysisComplete: (report: AgentAnalysisReport) => void;
}

export function OcrScannerSection({ selectedMember, onAnalysisComplete }: OcrScannerSectionProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [rawExtractedText, setRawExtractedText] = useState('');

  // Editable Verification Draft
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [allergensText, setAllergensText] = useState('');
  const [additivesText, setAdditivesText] = useState('');
  const [energyKcal, setEnergyKcal] = useState('');
  const [carbohydrates, setCarbohydrates] = useState('');
  const [sugars, setSugars] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [fiber, setFiber] = useState('');

  const [verifiedByUser, setVerifiedByUser] = useState(false);
  const [requestAlternatives, setRequestAlternatives] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setVerifiedByUser(false);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setOcrRunning(true);
    setOcrProgress(0);
    setOcrStatus('Initializing Tesseract.js OCR engine...');

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status) setOcrStatus(m.status);
          if (typeof m.progress === 'number') setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      const cleanedText = text.trim();
      setRawExtractedText(cleanedText);

      const parsed = parseOcrLabelText(cleanedText);
      setIngredientsText(parsed.ingredientsText);
      setAllergensText(parsed.allergensTags.join(', '));
      setAdditivesText(parsed.additivesTags.join(', '));
      setEnergyKcal(parsed.nutriments.energyKcal !== null ? String(parsed.nutriments.energyKcal) : '');
      setCarbohydrates(parsed.nutriments.carbohydrates !== null ? String(parsed.nutriments.carbohydrates) : '');
      setSugars(parsed.nutriments.sugars !== null ? String(parsed.nutriments.sugars) : '');
      setProtein(parsed.nutriments.protein !== null ? String(parsed.nutriments.protein) : '');
      setFat(parsed.nutriments.fat !== null ? String(parsed.nutriments.fat) : '');
      setSaturatedFat(parsed.nutriments.saturatedFat !== null ? String(parsed.nutriments.saturatedFat) : '');
      setSodium(parsed.nutriments.sodium !== null ? String(parsed.nutriments.sodium) : '');
      setFiber(parsed.nutriments.fiber !== null ? String(parsed.nutriments.fiber) : '');

      if (!cleanedText) {
        setError('OCR did not detect readable text. Please try a sharper, well-lit image or edit the fields manually.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `OCR extraction failed (${err.message}). You can retry or enter label details directly below.`
          : 'OCR extraction failed.'
      );
    } finally {
      setOcrRunning(false);
      setOcrStatus('');
      e.target.value = '';
    }
  };

  const toOptNum = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productName.trim()) {
      setError('Please enter the product name from the package before running analysis.');
      return;
    }
    if (!verifiedByUser) {
      setError('Please confirm that you have reviewed and verified the OCR-extracted fields before analysis.');
      return;
    }

    setAnalyzing(true);
    try {
      const { report } = await api.analyzeWithAgent({
        taskType: 'ocr_analysis',
        familyMemberId: selectedMember?.id ?? null,
        requestAlternatives,
        product: {
          name: productName.trim(),
          brand: brand.trim() || null,
          category: category.trim() || null,
          ingredientsText: ingredientsText.trim() || null,
          allergensTags: allergensText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          additivesTags: additivesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          nutriments: {
            energyKcal: toOptNum(energyKcal),
            carbohydrates: toOptNum(carbohydrates),
            sugars: toOptNum(sugars),
            protein: toOptNum(protein),
            fat: toOptNum(fat),
            saturatedFat: toOptNum(saturatedFat),
            sodium: toOptNum(sodium),
            salt: null,
            fiber: toOptNum(fiber),
          },
          source: 'ocr_verified',
          verifiedByUser: true,
        },
      });
      onAnalysisComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze OCR label.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Product Identification · Tesseract.js OCR
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">OCR Label Scanner</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Upload or capture a photograph of an ingredient or nutrition facts label. Extracted text is never treated as verified until you review and correct it below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step 1: Upload / Capture Label */}
        <div className="lg:col-span-5 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#111C16]">
            1. Capture or Upload Label Photo
          </h2>

          <div className="flex flex-wrap gap-2.5">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload Label Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleImageSelected(e)}
                disabled={ocrRunning}
                className="hidden"
              />
            </label>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer">
              <Camera className="w-4 h-4 text-[#4B5E53]" />
              <span>Take Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleImageSelected(e)}
                disabled={ocrRunning}
                className="hidden"
              />
            </label>
          </div>

          {ocrRunning && (
            <div className="p-4 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] space-y-2">
              <div className="flex items-center justify-between text-xs text-[#111C16]">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-[#15803D]" />
                  <span>{ocrStatus || 'Running OCR...'}</span>
                </span>
                <span className="font-mono tabular-nums font-semibold">{ocrProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#E4EAE6] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#15803D] transition-all duration-150"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}

          {previewUrl ? (
            <div className="rounded-lg border border-[#E4EAE6] overflow-hidden bg-[#F8FAF9]">
              <img
                src={previewUrl}
                alt="Uploaded food package label preview"
                className="w-full max-h-72 object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#CBD8D0] bg-[#F8FAF9] p-8 text-center space-y-2">
              <FileSearch className="w-8 h-8 text-[#5A6E62] mx-auto" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#111C16]">No label image uploaded</p>
              <p className="text-xs text-[#5A6E62]">
                Works best with flat, clearly lit photos of the ingredients paragraph or nutrition facts table.
              </p>
            </div>
          )}

          {rawExtractedText && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#5A6E62]">Raw Tesseract.js OCR Output (Unverified)</p>
              <pre className="p-3 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] text-xs font-mono text-[#33463B] whitespace-pre-wrap max-h-44 overflow-y-auto">
                {rawExtractedText}
              </pre>
            </div>
          )}
        </div>

        {/* Step 2: Mandatory User Verification & Correction Form */}
        <form
          onSubmit={(e) => void handleAnalyze(e)}
          className="lg:col-span-7 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              2. Review & Correct Extracted Data
            </h2>
            <span className="text-xs text-[#B45309] font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>User verification required</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Dark Chocolate Biscuits"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Brand (Optional)</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Baker's"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Category (Optional)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Chocolate biscuits"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Ingredients List (Verify OCR spelling accurately)
            </label>
            <textarea
              rows={4}
              value={ingredientsText}
              onChange={(e) => {
                setIngredientsText(e.target.value);
                setVerifiedByUser(false);
              }}
              placeholder="Extracted ingredients will appear here. Edit any OCR typos before analyzing."
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">
                Detected Allergens (comma-separated)
              </label>
              <input
                type="text"
                value={allergensText}
                onChange={(e) => setAllergensText(e.target.value)}
                placeholder="e.g. milk, wheat, peanuts"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">
                Additives / E-Numbers (comma-separated)
              </label>
              <input
                type="text"
                value={additivesText}
                onChange={(e) => setAdditivesText(e.target.value)}
                placeholder="e.g. E322, E500"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#4B5E53] mb-2">
              Nutritional Values per 100g (leave blank if unavailable on label)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Energy (kcal)', val: energyKcal, set: setEnergyKcal },
                { label: 'Sugars (g)', val: sugars, set: setSugars },
                { label: 'Protein (g)', val: protein, set: setProtein },
                { label: 'Total Fat (g)', val: fat, set: setFat },
                { label: 'Sat. Fat (g)', val: saturatedFat, set: setSaturatedFat },
                { label: 'Carbs (g)', val: carbohydrates, set: setCarbohydrates },
                { label: 'Sodium (g)', val: sodium, set: setSodium },
                { label: 'Fiber (g)', val: fiber, set: setFiber },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-[11px] text-[#5A6E62] mb-1">{field.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.val}
                    onChange={(e) => field.set(e.target.value)}
                    placeholder="—"
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] space-y-2.5">
            <label className="flex items-start gap-2.5 text-xs text-[#111C16] cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedByUser}
                onChange={(e) => setVerifiedByUser(e.target.checked)}
                className="mt-0.5 rounded border-[#D4DFD8] text-[#15803D] focus:ring-[#15803D]"
              />
              <span className="font-medium">
                I have reviewed the OCR-extracted ingredients, allergens, and nutritional numbers against the physical label and corrected any errors.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-[#4B5E53] cursor-pointer">
              <input
                type="checkbox"
                checked={requestAlternatives}
                onChange={(e) => setRequestAlternatives(e.target.checked)}
                className="mt-0.5 rounded border-[#D4DFD8] text-[#15803D] focus:ring-[#15803D]"
              />
              <span>Search Open Food Facts for alternative packaged products after analysis.</span>
            </label>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={analyzing || ocrRunning || !verifiedByUser}
            className="w-full py-2.5 px-5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Verified Label with Agent...</span>
              </>
            ) : verifiedByUser ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Analyze Verified Label</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Confirm Verification to Analyze</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
