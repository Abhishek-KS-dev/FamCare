import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import {
  AlertCircle,
  Camera,
  CameraOff,
  FileSearch,
  ImageUp,
  Loader2,
  ScanBarcode,
  Search,
  Utensils,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, type AgentAnalysisReport, type FamilyMemberRecord } from '../services/api.ts';
import type { NavSection } from './OverviewSection.tsx';

interface BarcodeScannerSectionProps {
  selectedMember: FamilyMemberRecord | null;
  onAnalysisComplete: (report: AgentAnalysisReport) => void;
  onNavigate: (section: NavSection) => void;
}

// Real, publicly verifiable Open Food Facts barcodes for live demonstration without a physical webcam package
const LIVE_OFF_TEST_BARCODES = [
  { code: '3017620422003', label: 'Nutella Hazelnut Spread (Contains Milk, Hazelnuts, Soy)' },
  { code: '7622210449283', label: 'LU Prince / Biscuits (Contains Wheat, Milk)' },
  { code: '5000159461122', label: 'Snickers Bar (Contains Peanuts, Milk, Soy, Egg)' },
  { code: '0030000010204', label: 'Quaker Old Fashioned Oats' },
];

export function BarcodeScannerSection({
  selectedMember,
  onAnalysisComplete,
  onNavigate,
}: BarcodeScannerSectionProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [requestAlternatives, setRequestAlternatives] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decodingImage, setDecodingImage] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stopCamera = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore teardown errors
    }
    controlsRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const runBarcodeAnalysis = async (codeToAnalyze: string) => {
    const cleaned = codeToAnalyze.replace(/\s+/g, '').trim();
    if (!/^[0-9]{4,20}$/.test(cleaned)) {
      setError('Please enter a valid numeric barcode (4 to 20 digits).');
      return;
    }

    stopCamera();
    setError(null);
    setNotFoundBarcode(null);
    setAnalyzing(true);

    try {
      const { report } = await api.analyzeWithAgent({
        taskType: 'barcode_analysis',
        barcode: cleaned,
        familyMemberId: selectedMember?.id ?? null,
        requestAlternatives,
      });

      if (!report.productFound) {
        setNotFoundBarcode(cleaned);
      }
      onAnalysisComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze barcode right now.');
    } finally {
      setAnalyzing(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setError(null);
    setNotFoundBarcode(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. Upload a barcode image or type the barcode below.');
      return;
    }

    try {
      setCameraActive(true);
      const reader = new BrowserMultiFormatReader();
      // Wait a tick for the <video> element to mount
      await new Promise((r) => setTimeout(r, 80));
      if (!videoRef.current) {
        setCameraActive(false);
        return;
      }

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText().replace(/\D/g, '');
            if (text.length >= 4) {
              setBarcodeInput(text);
              void runBarcodeAnalysis(text);
            }
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setCameraActive(false);
      setCameraError(
        err instanceof Error
          ? `Unable to access camera (${err.message}). You can upload a barcode photo or enter the barcode manually.`
          : 'Unable to access device camera.'
      );
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCameraError(null);
    setDecodingImage(true);
    const objectUrl = URL.createObjectURL(file);

    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = result.getText().replace(/\D/g, '');
      if (code.length >= 4) {
        setBarcodeInput(code);
        await runBarcodeAnalysis(code);
      } else {
        setError('Could not read a numeric barcode from the uploaded image.');
      }
    } catch {
      setError('No readable barcode detected in that image. Try a clearer photo or enter the digits manually.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setDecodingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runBarcodeAnalysis(barcodeInput);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Product Identification · ZXing + Open Food Facts
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Scan Product Barcode</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Scan a packaged food barcode with your camera or enter the digits directly. FamCare queries Open Food Facts live and routes the product through the central Food Intelligence Agent.
        </p>
      </div>

      {/* Active Family Screening Context */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <span className="text-[#5A6E62]">Screening profile: </span>
          <span className="font-semibold text-[#111C16]">
            {selectedMember
              ? `${selectedMember.name} (${selectedMember.allergies.length} allergies, ${selectedMember.dietaryRestrictions.length} dietary restrictions)`
              : 'None selected (general analysis only)'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('family')}
          className="text-xs font-medium text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
        >
          {selectedMember ? 'Edit Family Profile' : 'Select or Add Family Member'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Camera & Image Scanner Panel */}
        <div className="lg:col-span-7 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              Live Camera Scanner (ZXing)
            </h2>
            <div className="flex items-center gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#111C16] hover:bg-[#1F2E26] text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              )}

              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer">
                <ImageUp className="w-4 h-4 text-[#4B5E53]" />
                <span>{decodingImage ? 'Reading...' : 'Decode Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleImageUpload(e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="relative aspect-[16/10] w-full rounded-lg bg-[#101A14] border border-[#E4EAE6] overflow-hidden flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-3/4 max-w-sm h-28 border-2 border-[#4ADE80]/85 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              </>
            ) : (
              <div className="text-center p-6 max-w-sm space-y-2">
                <ScanBarcode className="w-10 h-10 text-[#6B8475] mx-auto" strokeWidth={1.5} />
                <p className="text-sm font-medium text-white">Camera preview is paused</p>
                <p className="text-xs text-[#A9BCB0]">
                  Click "Start Camera" to scan EAN-13, UPC-A, or EAN-8 barcodes, or upload a photo containing a barcode.
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode Lookup & Live Open Food Facts Examples */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              Enter Barcode Number
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="barcode-field" className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                  EAN / UPC Numeric Barcode
                </label>
                <input
                  id="barcode-field"
                  type="text"
                  inputMode="numeric"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. 3017620422003"
                  className="w-full px-3.5 py-2.5 font-mono tabular-nums text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#4B5E53] cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestAlternatives}
                  onChange={(e) => setRequestAlternatives(e.target.checked)}
                  className="mt-0.5 rounded border-[#D4DFD8] text-[#15803D] focus:ring-[#15803D]"
                />
                <span>
                  Always search Open Food Facts for alternative recommendations (agent also triggers this automatically on allergy/dietary conflicts).
                </span>
              </label>

              <button
                type="submit"
                disabled={analyzing}
                className="w-full py-2.5 px-4 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running Food Intelligence Agent...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Retrieve & Analyze Product</span>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {error}
              </div>
            )}

            {notFoundBarcode && (
              <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] space-y-3">
                <p className="text-xs font-semibold text-[#92400E]">
                  Barcode {notFoundBarcode} was not found in Open Food Facts.
                </p>
                <p className="text-xs text-[#92400E]">
                  FamCare never fabricates product ingredients or nutritional values. Continue with OCR label scanning or manual food entry:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('ocr')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#F59E0B] text-[#92400E] text-xs font-medium rounded-md hover:bg-[#FEF3C7] cursor-pointer"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Open OCR Scanner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('manual')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D4DFD8] text-[#111C16] text-xs font-medium rounded-md hover:bg-[#F8FAF9] cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Manual Food Entry</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Open Food Facts Lookup Barcodes */}
          <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[#111C16]">
              Quick Live Open Food Facts Lookups
            </h3>
            <p className="text-xs text-[#5A6E62]">
              Select a real packaged barcode to query Open Food Facts live over HTTPS (no mock data):
            </p>
            <div className="divide-y divide-[#EDF2EE]">
              {LIVE_OFF_TEST_BARCODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  disabled={analyzing}
                  onClick={() => {
                    setBarcodeInput(item.code);
                    void runBarcodeAnalysis(item.code);
                  }}
                  className="w-full py-2.5 text-left hover:bg-[#F8FAF9] px-2 -mx-2 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <p className="font-mono tabular-nums text-xs font-semibold text-[#15803D]">
                    {item.code}
                  </p>
                  <p className="text-xs text-[#4B5E53] mt-0.5">{item.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
