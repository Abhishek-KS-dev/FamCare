import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Info,
  Loader2,
  Search,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  api,
  type AgentAnalysisReport,
  type FamilyMemberRecord,
  type IFCTSearchResult,
  type ProductData,
  type PurchaseRecord,
} from '../services/api.ts';

interface ManualEntrySectionProps {
  selectedMember: FamilyMemberRecord | null;
  onAnalysisComplete: (report: AgentAnalysisReport) => void;
}

const UNPACKAGED_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains & Rice',
  'Meat & Poultry',
  'Fish & Seafood',
  'Dairy & Eggs',
  'Sugar & Sweeteners',
  'Legumes & Pulses',
  'Nuts & Seeds',
  'Herbs & Spices',
  'Other Unpackaged Food',
] as const;

type UnpackagedCategory = (typeof UNPACKAGED_CATEGORIES)[number];

const ALLOWED_UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'bunch', 'bag'] as const;
type UnitType = (typeof ALLOWED_UNITS)[number];

interface TemplateItem {
  name: string;
  category: UnpackagedCategory;
  defaultAmount: string;
  defaultUnit: UnitType;
  ingredients?: string;
}

const TEMPLATES: TemplateItem[] = [
  { name: 'White Rice', category: 'Grains & Rice', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Basmati Rice', category: 'Grains & Rice', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Brown Rice', category: 'Grains & Rice', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Rolled Oats', category: 'Grains & Rice', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Fresh Spinach', category: 'Vegetables', defaultAmount: '1', defaultUnit: 'bunch' },
  { name: 'Broccoli', category: 'Vegetables', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Carrots', category: 'Vegetables', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Tomatoes', category: 'Vegetables', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Yellow Onions', category: 'Vegetables', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Potatoes', category: 'Vegetables', defaultAmount: '2', defaultUnit: 'kg' },
  { name: 'Fresh Green Apples', category: 'Fruits', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Bananas', category: 'Fruits', defaultAmount: '1', defaultUnit: 'bunch' },
  { name: 'Oranges', category: 'Fruits', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Fresh Chicken Breast', category: 'Meat & Poultry', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Ground Beef', category: 'Meat & Poultry', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Atlantic Salmon Fillet', category: 'Fish & Seafood', defaultAmount: '400', defaultUnit: 'g' },
  { name: 'White Shrimp', category: 'Fish & Seafood', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Whole Milk', category: 'Dairy & Eggs', defaultAmount: '1', defaultUnit: 'L' },
  { name: 'Eggs (Dozen)', category: 'Dairy & Eggs', defaultAmount: '12', defaultUnit: 'pcs' },
  { name: 'Refined White Sugar', category: 'Sugar & Sweeteners', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Raw Honey', category: 'Sugar & Sweeteners', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Red Lentils', category: 'Legumes & Pulses', defaultAmount: '1', defaultUnit: 'kg' },
  { name: 'Chickpeas', category: 'Legumes & Pulses', defaultAmount: '500', defaultUnit: 'g' },
  { name: 'Raw Almonds', category: 'Nuts & Seeds', defaultAmount: '250', defaultUnit: 'g' },
  { name: 'Walnuts', category: 'Nuts & Seeds', defaultAmount: '250', defaultUnit: 'g' },
  { name: 'Fresh Cilantro / Coriander', category: 'Herbs & Spices', defaultAmount: '1', defaultUnit: 'bunch' },
  { name: 'Fresh Basil', category: 'Herbs & Spices', defaultAmount: '1', defaultUnit: 'bunch' },
  { name: 'Homemade Vegetable Soup', category: 'Other Unpackaged Food', defaultAmount: '500', defaultUnit: 'ml' },
];

export function parseNaturalLanguageInput(text: string): {
  success: boolean;
  name: string;
  quantityValue: string;
  unit: UnitType;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { success: false, name: '', quantityValue: '', unit: 'kg' };
  }

  // Regex pattern: optional leading number (e.g. 2, 2.5, 1/2), optional unit, remainder is name
  // Match e.g. "2 kg basmati rice", "500g spinach", "1 bunch fresh mint", "3 pcs apple"
  const regex = /^(\d+(?:\.\d+)?|\d+\/\d+)?\s*(kg|kilo|kilogram|kilograms|g|gram|grams|l|liter|liters|litre|litres|ml|milliliter|milliliters|pcs|pc|piece|pieces|bunch|bunches|bag|bags)?\s*(?:of\s+)?(.+)$/i;
  const match = trimmed.match(regex);

  if (match) {
    const rawNum = match[1] || '';
    const rawUnit = match[2] ? match[2].toLowerCase() : '';
    let namePart = match[3] ? match[3].trim() : '';

    // Handle portion phrases like "a bunch of", "a bag of", "a handful of"
    if (!rawNum && /^(a|an|one)\s+(bunch|bag|handful|bowl|piece|kg|gram)\s+(?:of\s+)?/i.test(trimmed)) {
      const portionMatch = trimmed.match(/^(?:a|an|one)\s+(bunch|bag|handful|bowl|piece|kg|gram)\s+(?:of\s+)?(.+)$/i);
      if (portionMatch) {
        const pUnit = portionMatch[1].toLowerCase();
        namePart = portionMatch[2].trim();
        if (pUnit === 'bunch' || pUnit === 'bunches') {
          return { success: true, name: capitalizeWords(namePart), quantityValue: '1', unit: 'bunch' };
        }
        if (pUnit === 'bag' || pUnit === 'bags') {
          return { success: true, name: capitalizeWords(namePart), quantityValue: '1', unit: 'bag' };
        }
        if (pUnit === 'piece') {
          return { success: true, name: capitalizeWords(namePart), quantityValue: '1', unit: 'pcs' };
        }
        if (pUnit === 'kg') {
          return { success: true, name: capitalizeWords(namePart), quantityValue: '1', unit: 'kg' };
        }
        if (pUnit === 'gram') {
          return { success: true, name: capitalizeWords(namePart), quantityValue: '100', unit: 'g' };
        }
        // Ambiguous portion like "a handful", "one bowl" -> client-side regex cannot reliably parse exact grams
        return { success: false, name: trimmed, quantityValue: '', unit: 'kg' };
      }
    }

    if (namePart && (rawNum || rawUnit)) {
      let mappedUnit: UnitType = 'kg';
      if (['kg', 'kilo', 'kilogram', 'kilograms'].includes(rawUnit)) mappedUnit = 'kg';
      else if (['g', 'gram', 'grams'].includes(rawUnit)) mappedUnit = 'g';
      else if (['l', 'liter', 'liters', 'litre', 'litres'].includes(rawUnit)) mappedUnit = 'L';
      else if (['ml', 'milliliter', 'milliliters'].includes(rawUnit)) mappedUnit = 'ml';
      else if (['pcs', 'pc', 'piece', 'pieces'].includes(rawUnit)) mappedUnit = 'pcs';
      else if (['bunch', 'bunches'].includes(rawUnit)) mappedUnit = 'bunch';
      else if (['bag', 'bags'].includes(rawUnit)) mappedUnit = 'bag';

      let numVal = rawNum;
      if (rawNum.includes('/')) {
        const [num, den] = rawNum.split('/').map(Number);
        if (den) numVal = (num / den).toFixed(2);
      }

      return {
        success: true,
        name: capitalizeWords(namePart),
        quantityValue: numVal || '1',
        unit: mappedUnit,
      };
    }
  }

  return { success: false, name: trimmed, quantityValue: '', unit: 'kg' };
}

function inferCategoryFromName(name: string): UnpackagedCategory {
  const n = name.toLowerCase();
  if (/\b(rice|oat|oats|wheat|barley|quinoa|grain|grains|flour|pasta)\b/.test(n)) return 'Grains & Rice';
  if (/\b(spinach|broccoli|carrot|carrots|tomato|tomatoes|onion|onions|potato|potatoes|lettuce|cabbage|cucumber|pepper|peppers|kale|garlic)\b/.test(n)) return 'Vegetables';
  if (/\b(apple|apples|banana|bananas|orange|oranges|berry|berries|grape|grapes|mango|melon|lemon|peach|pear)\b/.test(n)) return 'Fruits';
  if (/\b(chicken|beef|pork|turkey|lamb|mutton|meat|steak|breast|poultry)\b/.test(n)) return 'Meat & Poultry';
  if (/\b(salmon|fish|tuna|shrimp|prawn|prawns|crab|lobster|cod|tilapia|seafood)\b/.test(n)) return 'Fish & Seafood';
  if (/\b(milk|egg|eggs|cheese|yogurt|yoghurt|butter|cream|dairy)\b/.test(n)) return 'Dairy & Eggs';
  if (/\b(sugar|sweetener|honey|maple|syrup|jaggery)\b/.test(n)) return 'Sugar & Sweeteners';
  if (/\b(lentil|lentils|chickpea|chickpeas|bean|beans|pulse|pulses|dal|dhal)\b/.test(n)) return 'Legumes & Pulses';
  if (/\b(almond|almonds|walnut|walnuts|cashew|cashews|peanut|peanuts|nut|nuts|seed|seeds|chia)\b/.test(n)) return 'Nuts & Seeds';
  if (/\b(cilantro|coriander|basil|parsley|mint|rosemary|thyme|spice|spices|cinnamon|turmeric|cumin|herb|herbs)\b/.test(n)) return 'Herbs & Spices';
  return 'Other Unpackaged Food';
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ManualEntrySection({ selectedMember, onAnalysisComplete }: ManualEntrySectionProps) {
  // Tab: 'guided' | 'quick'
  const [activeTab, setActiveTab] = useState<'guided' | 'quick'>('guided');

  // Step 1: Basic Information
  const [name, setName] = useState('');
  const [category, setCategory] = useState<UnpackagedCategory>('Vegetables');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<UnitType>('kg');

  // Suggestions state
  const [ifctSuggestions, setIfctSuggestions] = useState<IFCTSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<ProductData[]>([]);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [preFillNote, setPreFillNote] = useState<string | null>(null);

  // Step 2: Nutrition facts (optional)
  const [step2Open, setStep2Open] = useState(false);
  const [ingredientsText, setIngredientsText] = useState('');
  const [energyKcal, setEnergyKcal] = useState('');
  const [carbohydrates, setCarbohydrates] = useState('');
  const [sugars, setSugars] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [fiber, setFiber] = useState('');

  // Quick Text state
  const [quickText, setQuickText] = useState('');
  const [pendingQuickConfirmation, setPendingQuickConfirmation] = useState<{
    understoodText: string;
    product: Partial<ProductData>;
    report?: AgentAnalysisReport;
  } | null>(null);

  // Recent Items
  const [recentPurchases, setRecentPurchases] = useState<PurchaseRecord[]>([]);

  // Common Templates state
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('All');

  // UI state
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement | null>(null);

  // Load Recent Purchases (filtered to manual_entry, capped at 5)
  useEffect(() => {
    let isMounted = true;
    api
      .listPurchases()
      .then((res) => {
        if (!isMounted) return;
        const manualItems = (res.purchases || [])
          .filter((p) => p.source === 'manual_entry')
          .slice(0, 5);
        setRecentPurchases(manualItems);
      })
      .catch(() => {
        // Silently ignore purchase fetch errors for manual entry widget
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close suggestions when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsBoxRef.current && !suggestionsBoxRef.current.contains(e.target as Node)) {
        setShowSuggestionsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search IFCT and Open Food Facts suggestions as user types
  const handleNameChange = (val: string) => {
    setName(val);
    setPreFillNote(null);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    const query = val.trim();
    if (query.length < 2) {
      setIfctSuggestions([]);
      setSuggestions([]);
      setShowSuggestionsDropdown(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchingSuggestions(true);
      try {
        const [ifctRes, offRes] = await Promise.allSettled([
          api.searchIFCT(query),
          api.searchProducts(query),
        ]);
        const ifctItems = ifctRes.status === 'fulfilled' ? ifctRes.value.results || [] : [];
        const offItems = offRes.status === 'fulfilled' ? (offRes.value.products || []).slice(0, 5) : [];
        setIfctSuggestions(ifctItems);
        setSuggestions(offItems);
        setShowSuggestionsDropdown(ifctItems.length > 0 || offItems.length > 0);
      } catch {
        setIfctSuggestions([]);
        setSuggestions([]);
      } finally {
        setSearchingSuggestions(false);
      }
    }, 300);
  };

  // Pre-fill from IFCT / Indian Dishes suggestion
  const handleSelectIFCTSuggestion = (res: IFCTSearchResult) => {
    const item = res.item;
    setName(item.name);
    if (item.group && UNPACKAGED_CATEGORIES.includes(item.group as UnpackagedCategory)) {
      setCategory(item.group as UnpackagedCategory);
    } else {
      setCategory(inferCategoryFromName(item.name));
    }

    // Pre-fill nutrients from item (keeps them editable)
    setEnergyKcal(item.per100g.energyKcal !== null ? String(item.per100g.energyKcal) : '');
    setCarbohydrates(item.per100g.carbohydrates !== null ? String(item.per100g.carbohydrates) : '');
    setSugars(item.per100g.sugars !== null ? String(item.per100g.sugars) : '');
    setProtein(item.per100g.protein !== null ? String(item.per100g.protein) : '');
    setFat(item.per100g.fat !== null ? String(item.per100g.fat) : '');
    setSaturatedFat(item.per100g.saturatedFat !== null ? String(item.per100g.saturatedFat) : '');
    setSodium(item.per100g.sodium !== null ? String(item.per100g.sodium) : '');
    setFiber(item.per100g.fiber !== null ? String(item.per100g.fiber) : '');
    setIngredientsText(item.name);

    if (item.dataset === 'ifct_2017') {
      setPreFillNote('IFCT 2017, raw, per 100 g edible portion');
    } else {
      let note = 'Approximate values for a prepared dish. The serving basis of this dataset is not verified, so please check them before analyzing.';
      if (item.reliability === 'low') {
        note += ' These values were flagged as unreliable.';
      }
      setPreFillNote(note);
    }
    setShowSuggestionsDropdown(false);
  };

  // Pre-fill from OFF suggestion
  const handleSelectSuggestion = (p: ProductData) => {
    setName(p.name);
    // Find best category or infer
    if (p.category && UNPACKAGED_CATEGORIES.includes(p.category as UnpackagedCategory)) {
      setCategory(p.category as UnpackagedCategory);
    } else {
      setCategory(inferCategoryFromName(p.name));
    }

    // Pre-fill nutrients from product
    setEnergyKcal(p.nutriments.energyKcal !== null ? String(p.nutriments.energyKcal) : '');
    setCarbohydrates(p.nutriments.carbohydrates !== null ? String(p.nutriments.carbohydrates) : '');
    setSugars(p.nutriments.sugars !== null ? String(p.nutriments.sugars) : '');
    setProtein(p.nutriments.protein !== null ? String(p.nutriments.protein) : '');
    setFat(p.nutriments.fat !== null ? String(p.nutriments.fat) : '');
    setSaturatedFat(p.nutriments.saturatedFat !== null ? String(p.nutriments.saturatedFat) : '');
    setSodium(p.nutriments.sodium !== null ? String(p.nutriments.sodium) : '');
    setFiber(p.nutriments.fiber !== null ? String(p.nutriments.fiber) : '');
    if (p.ingredientsText) {
      setIngredientsText(p.ingredientsText);
    }

    setPreFillNote('Values pre-filled from a similar Open Food Facts product — not verified for your item.');
    setShowSuggestionsDropdown(false);
  };

  const toOptNum = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // Trigger analysis execution
  const executeAnalysis = async (
    foodName: string,
    cat: string,
    quantityStr: string,
    ingText: string,
    rawEntryText?: string | null
  ) => {
    setError(null);
    setAnalyzing(true);
    try {
      const { report } = await api.analyzeWithAgent({
        taskType: 'manual_analysis',
        familyMemberId: selectedMember?.id ?? null,
        requestAlternatives: false,
        rawEntryText: rawEntryText || null,
        product: {
          name: foodName.trim(),
          brand: null,
          category: cat,
          quantity: quantityStr.trim() || null,
          ingredientsText: ingText.trim() || foodName.trim(),
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
          source: 'manual_entry',
        },
      });
      return report;
    } finally {
      setAnalyzing(false);
    }
  };

  // Guided Form Submission
  const handleGuidedSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a food item name.');
      return;
    }
    try {
      const quantityStr = `${amount.trim()} ${unit}`.trim();
      const report = await executeAnalysis(name, category, quantityStr, ingredientsText);
      onAnalysisComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze manual entry.');
    }
  };

  // Quick Text Submission
  const handleQuickSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const text = quickText.trim();
    if (!text) {
      setError('Please enter what you bought (e.g. "2 kg basmati rice").');
      return;
    }

    // Step 7a: Client-side regex pre-parse
    const parsed = parseNaturalLanguageInput(text);
    if (parsed.success) {
      const inferredCat = inferCategoryFromName(parsed.name);
      const quantityStr = `${parsed.quantityValue} ${parsed.unit}`.trim();

      // Look up IFCT 2017 nutrition facts for parsed food name
      let attachedNutriments = undefined;
      let resolvedSource: 'manual_entry' | 'ifct_2017' = 'manual_entry';
      try {
        const ifctRes = await api.searchIFCT(parsed.name);
        if (ifctRes.results && ifctRes.results.length > 0) {
          const topMatch = ifctRes.results[0];
          // Only auto-attach when top match is from ifct_2017 and reasonably strong (score <= 0.4)
          if (topMatch.item.dataset === 'ifct_2017' && topMatch.score <= 0.4) {
            attachedNutriments = topMatch.product.nutriments;
            resolvedSource = 'ifct_2017';
          }
        }
      } catch {
        // Silently continue without failing quick mode confirmation
      }

      // Show confirmation step: "We understood: 2 kg basmati rice (Grains & Rice). Correct?"
      setPendingQuickConfirmation({
        understoodText: `${quantityStr} ${parsed.name} (${inferredCat})`,
        product: {
          name: parsed.name,
          category: inferredCat,
          quantity: quantityStr,
          ingredientsText: parsed.name,
          source: resolvedSource,
          ...(attachedNutriments ? { nutriments: attachedNutriments } : {}),
        },
      });
      return;
    }

    // Step 7b: Ambiguous portion or phrasing -> send to backend as manual_analysis with rawEntryText
    setAnalyzing(true);
    try {
      const placeholderName = text.slice(0, 100);
      const inferredCat = inferCategoryFromName(text);
      const { report } = await api.analyzeWithAgent({
        taskType: 'manual_analysis',
        familyMemberId: selectedMember?.id ?? null,
        requestAlternatives: false,
        rawEntryText: text,
        product: {
          name: placeholderName,
          category: inferredCat,
          source: 'manual_entry',
          ingredientsText: text,
        },
      });

      // If backend was deterministic fallback and couldn't parse
      if (report.orchestrationMode === 'deterministic_fallback' && (!report.product || !report.product.name)) {
        setError('Could not interpret text automatically. Please switch to Guided mode to enter details.');
        return;
      }

      const finalProduct: Partial<ProductData> = report.product || {
        name: placeholderName,
        category: inferredCat,
        quantity: null,
        source: 'manual_entry' as const,
      };

      const displayQty = finalProduct.quantity ? `${finalProduct.quantity} ` : '';
      setPendingQuickConfirmation({
        understoodText: `${displayQty}${finalProduct.name || placeholderName} (${finalProduct.category || inferredCat})`,
        product: finalProduct,
        report,
      });
    } catch (err) {
      // Step 7c: If Gemini is unavailable and text didn't regex parse, show clear error
      setError('Unable to parse your text with AI. Please switch to Guided mode.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Confirm Quick Text result
  const handleConfirmQuick = async () => {
    if (!pendingQuickConfirmation) return;
    try {
      if (pendingQuickConfirmation.report) {
        onAnalysisComplete(pendingQuickConfirmation.report);
      } else {
        const p = pendingQuickConfirmation.product;
        const report = await executeAnalysis(
          p.name || 'Food Item',
          p.category || 'Other Unpackaged Food',
          p.quantity || '',
          p.ingredientsText || p.name || 'Food Item',
          quickText
        );
        onAnalysisComplete(report);
      }
      setPendingQuickConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed upon confirmation.');
    }
  };

  // Switch to Guided mode with fields pre-filled from quick text
  const handleEditQuick = () => {
    if (!pendingQuickConfirmation) return;
    const p = pendingQuickConfirmation.product;
    setName(p.name || '');
    if (p.category && UNPACKAGED_CATEGORIES.includes(p.category as UnpackagedCategory)) {
      setCategory(p.category as UnpackagedCategory);
    }
    if (p.quantity) {
      const match = p.quantity.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
      if (match) {
        setAmount(match[1]);
        const matchedUnit = match[2]?.toLowerCase();
        if (matchedUnit && ALLOWED_UNITS.includes(matchedUnit as UnitType)) {
          setUnit(matchedUnit as UnitType);
        }
      }
    }
    if (p.nutriments) {
      setEnergyKcal(p.nutriments.energyKcal !== null && p.nutriments.energyKcal !== undefined ? String(p.nutriments.energyKcal) : '');
      setCarbohydrates(p.nutriments.carbohydrates !== null && p.nutriments.carbohydrates !== undefined ? String(p.nutriments.carbohydrates) : '');
      setSugars(p.nutriments.sugars !== null && p.nutriments.sugars !== undefined ? String(p.nutriments.sugars) : '');
      setProtein(p.nutriments.protein !== null && p.nutriments.protein !== undefined ? String(p.nutriments.protein) : '');
      setFat(p.nutriments.fat !== null && p.nutriments.fat !== undefined ? String(p.nutriments.fat) : '');
      setSaturatedFat(p.nutriments.saturatedFat !== null && p.nutriments.saturatedFat !== undefined ? String(p.nutriments.saturatedFat) : '');
      setSodium(p.nutriments.sodium !== null && p.nutriments.sodium !== undefined ? String(p.nutriments.sodium) : '');
      setFiber(p.nutriments.fiber !== null && p.nutriments.fiber !== undefined ? String(p.nutriments.fiber) : '');
      if (p.source === 'ifct_2017') {
        setPreFillNote('IFCT 2017, raw, per 100 g edible portion');
        setStep2Open(true);
      }
    }
    setPendingQuickConfirmation(null);
    setActiveTab('guided');
  };

  // Common templates filter
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchSearch =
        templateSearch.trim() === '' ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.category.toLowerCase().includes(templateSearch.toLowerCase());
      const matchCategory =
        templateCategoryFilter === 'All' || t.category === templateCategoryFilter;
      return matchSearch && matchCategory;
    });
  }, [templateSearch, templateCategoryFilter]);

  // Click on Template item: HARD RULE - NEVER PRE-FILL NUTRITION VALUES
  const handleSelectTemplate = (template: TemplateItem) => {
    setName(template.name);
    setCategory(template.category);
    setAmount(template.defaultAmount);
    setUnit(template.defaultUnit);
    setIngredientsText(template.ingredients || template.name);
    // Nutrition fields stay untouched / empty
    setPreFillNote(null);
    if (activeTab !== 'guided') {
      setActiveTab('guided');
    }
  };

  // Click on Recent item: HARD RULE - NEVER PRE-FILL NUTRITION VALUES
  const handleSelectRecent = (item: PurchaseRecord) => {
    setName(item.productName);
    if (item.category && UNPACKAGED_CATEGORIES.includes(item.category as UnpackagedCategory)) {
      setCategory(item.category as UnpackagedCategory);
    } else {
      setCategory(inferCategoryFromName(item.productName));
    }
    setAmount(String(item.quantity || '1'));
    setIngredientsText(item.productName);
    setPreFillNote(null);
    if (activeTab !== 'guided') {
      setActiveTab('guided');
    }
  };

  const showIngredientsInput = category === 'Other Unpackaged Food' || step2Open;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Product Identification · Unpackaged Foods
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Manual Food Entry</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Enter fresh or unpackaged items such as rice, vegetables, fruits, meat, or bulk staples.
          Missing nutrients are shown as unavailable rather than invented.
        </p>
      </div>

      {/* Frequently Added Items (Recent Purchases) */}
      {recentPurchases.length > 0 && (
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="w-3.5 h-3.5 text-[#15803D]" />
            <span className="text-xs font-semibold text-[#111C16]">Recently Added Items</span>
            <span className="text-[11px] text-[#5A6E62]">(tap to re-fill)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentPurchases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectRecent(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F7F5] hover:bg-[#E8EFEA] text-[#111C16] border border-[#D4DFD8] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <span>{item.productName}</span>
                <span className="text-[10px] text-[#5A6E62]">
                  ({item.quantity} · {item.category})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs: Guided vs Quick Text */}
      <div className="flex border-b border-[#E4EAE6] gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('guided');
            setPendingQuickConfirmation(null);
          }}
          className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'guided'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-[#5A6E62] hover:text-[#111C16]'
          }`}
        >
          Guided (2-step form)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('quick');
            setError(null);
          }}
          className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'quick'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-[#5A6E62] hover:text-[#111C16]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quick text</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Entry Panel */}
        <div className="lg:col-span-8 space-y-4">
          {activeTab === 'quick' ? (
            /* Quick Text Form */
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                  Natural Language Food Entry
                </label>
                <p className="text-xs text-[#5A6E62] mb-3">
                  Type what you bought naturally. We'll automatically identify the food name, category, and quantity.
                </p>
                <form onSubmit={(e) => void handleQuickSubmit(e)} className="space-y-4">
                  <textarea
                    rows={3}
                    value={quickText}
                    onChange={(e) => {
                      setQuickText(e.target.value);
                      setPendingQuickConfirmation(null);
                      setError(null);
                    }}
                    placeholder='e.g. "2 kg basmati rice" or "a bunch of fresh spinach" or "a handful of almonds"'
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                  />

                  {error && (
                    <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                      {error}
                    </div>
                  )}

                  {!pendingQuickConfirmation && (
                    <button
                      type="submit"
                      disabled={analyzing || !quickText.trim()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Interpreting Entry...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Parse & Analyze</span>
                        </>
                      )}
                    </button>
                  )}
                </form>

                {/* Natural Language Confirmation Step */}
                {pendingQuickConfirmation && (
                  <div className="mt-4 p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-[#166534]">
                          We understood:{' '}
                          <span className="font-bold text-[#14532D]">
                            {pendingQuickConfirmation.understoodText}
                          </span>
                          . Correct?
                        </p>
                        <p className="text-xs text-[#15803D] mt-0.5">
                          Confirm to proceed with nutrition intelligence or edit details in Guided mode.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleConfirmQuick()}
                        disabled={analyzing}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        {analyzing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Confirm</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleEditQuick}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F8FAF9] text-[#4B5E53] border border-[#D4DFD8] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Guided 2-Step Form */
            <form
              onSubmit={(e) => void handleGuidedSubmit(e)}
              className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-6"
            >
              {/* Step 1: What did you buy? */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-[#111C16]">
                    Step 1: What did you buy?
                  </h2>
                  <span className="text-xs font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-0.5 rounded-full">
                    Required
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Food Name with search suggestions */}
                  <div className="sm:col-span-12 relative" ref={suggestionsBoxRef}>
                    <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                      Food Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        onFocus={() => {
                          if (ifctSuggestions.length > 0 || suggestions.length > 0) setShowSuggestionsDropdown(true);
                        }}
                        placeholder="e.g. Basmati Rice, Fresh Spinach, Okra"
                        className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D] pr-9"
                      />
                      {searchingSuggestions && (
                        <Loader2 className="w-4 h-4 text-[#5A6E62] animate-spin absolute right-3 top-2.5" />
                      )}
                    </div>

                    {/* Suggestions Dropdown: IFCT matches first, then Open Food Facts */}
                    {showSuggestionsDropdown && (ifctSuggestions.length > 0 || suggestions.length > 0) && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D4DFD8] rounded-lg shadow-lg overflow-hidden divide-y divide-[#EDF2EE] max-h-72 overflow-y-auto">
                        <div className="px-3 py-1.5 bg-[#F8FAF9] text-[11px] font-medium text-[#5A6E62] flex justify-between items-center sticky top-0 z-10 border-b border-[#EDF2EE]">
                          <span>Food Database Suggestions</span>
                          <button
                            type="button"
                            onClick={() => setShowSuggestionsDropdown(false)}
                            className="text-[#5A6E62] hover:text-[#111C16]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* 1. IFCT Matches (raw ingredients) */}
                        {ifctSuggestions.filter((r) => r.item.dataset === 'ifct_2017').length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-[#F0FDF4] text-[10px] font-semibold text-[#15803D] uppercase tracking-wider">
                              IFCT 2017 (raw ingredients)
                            </div>
                            {ifctSuggestions
                              .filter((r) => r.item.dataset === 'ifct_2017')
                              .map((res) => (
                                <button
                                  key={res.item.id}
                                  type="button"
                                  onClick={() => handleSelectIFCTSuggestion(res)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-[#F0FDF4] transition-colors flex items-center justify-between text-xs cursor-pointer"
                                >
                                  <div>
                                    <p className="font-medium text-[#111C16]">{res.item.name}</p>
                                    <p className="text-[11px] text-[#5A6E62]">
                                      {res.item.group} · {res.item.aliases.slice(0, 3).join(', ')}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-[#15803D] font-medium bg-[#DCFCE7] px-2 py-0.5 rounded">
                                    IFCT Pre-fill
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}

                        {/* 2. Indian Dishes Matches (approximate) */}
                        {ifctSuggestions.filter((r) => r.item.dataset !== 'ifct_2017').length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-[#FEF3C7] text-[10px] font-semibold text-[#B45309] uppercase tracking-wider">
                              Indian dishes (approximate)
                            </div>
                            {ifctSuggestions
                              .filter((r) => r.item.dataset !== 'ifct_2017')
                              .map((res) => (
                                <button
                                  key={res.item.id}
                                  type="button"
                                  onClick={() => handleSelectIFCTSuggestion(res)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-[#FFFBEB] transition-colors flex items-center justify-between text-xs cursor-pointer"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-[#111C16]">{res.item.name}</p>
                                      {res.item.reliability === 'low' && (
                                        <span className="text-[10px] text-[#B91C1C] bg-[#FEE2E2] px-1.5 py-0.2 rounded font-normal">
                                          values may be inaccurate
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#5A6E62]">
                                      {res.item.group}
                                      {res.item.aliases && res.item.aliases.length > 0 ? ` · ${res.item.aliases.slice(0, 3).join(', ')}` : ''}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-[#B45309] font-medium bg-[#FEF3C7] px-2 py-0.5 rounded">
                                    Dish Pre-fill
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}

                        {/* 3. Open Food Facts Matches */}
                        {suggestions.length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-[#F8FAF9] text-[10px] font-semibold text-[#5A6E62] uppercase tracking-wider">
                              Open Food Facts Products
                            </div>
                            {suggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleSelectSuggestion(s)}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#F8FAF9] transition-colors flex items-center justify-between text-xs cursor-pointer"
                              >
                                <div>
                                  <p className="font-medium text-[#111C16]">{s.name}</p>
                                  <p className="text-[11px] text-[#5A6E62]">
                                    {s.brand ? `${s.brand} · ` : ''}
                                    {s.category || 'Uncategorized'}
                                  </p>
                                </div>
                                <span className="text-[10px] text-[#4B5E53] font-medium bg-[#E8EFEA] px-2 py-0.5 rounded">
                                  OFF Pre-fill
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pre-fill Note */}
                    {preFillNote && (
                      <div className="mt-2 p-2.5 rounded-lg bg-[#F8FAF9] border border-[#D4DFD8] text-xs text-[#4B5E53] flex items-center gap-2">
                        <Info className="w-4 h-4 text-[#15803D] shrink-0" />
                        <span>{preFillNote}</span>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as UnpackagedCategory)}
                      className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                    >
                      {UNPACKAGED_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount + Unit */}
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                      Amount *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="1"
                        className="w-1/2 px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                      />
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as UnitType)}
                        className="w-1/2 px-2.5 py-2 text-sm border border-[#D4DFD8] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                      >
                        {ALLOWED_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Conditional Ingredients input: only if category suggests multi-ingredient item or in step 2 */}
                {showIngredientsInput && (
                  <div>
                    <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                      Ingredients / Recipe Composition (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={ingredientsText}
                      onChange={(e) => setIngredientsText(e.target.value)}
                      placeholder="e.g. Tomatoes, onions, olive oil, salt..."
                      className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                    />
                  </div>
                )}
              </div>

              {/* Step 2: Add nutrition facts (optional) */}
              <div className="border border-[#E4EAE6] rounded-xl overflow-hidden">
                <details
                  open={step2Open}
                  onToggle={(e) => setStep2Open(e.currentTarget.open)}
                  className="group"
                >
                  <summary className="flex items-center justify-between p-4 bg-[#F8FAF9] hover:bg-[#F0FDF4] cursor-pointer transition-colors list-none select-none">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-[#111C16]">
                        Step 2: Add nutrition facts (optional)
                      </h3>
                      <span className="text-[11px] text-[#5A6E62]">· only enter values you know</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#5A6E62] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="p-5 bg-white space-y-4 border-t border-[#E4EAE6]">
                    <p className="text-xs text-[#5A6E62]">
                      Per 100g nutritional facts. You can skip any unknown fields; missing fields will be reported as unavailable rather than assumed zero.
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
                      ].map((f) => (
                        <div key={f.label}>
                          <label className="block text-[11px] text-[#5A6E62] mb-1">{f.label}</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={f.val}
                            onChange={(e) => f.set(e.target.value)}
                            placeholder="Unavailable"
                            className="w-full px-2.5 py-1.5 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              {error && (
                <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                  {error}
                </div>
              )}

              {/* Action Buttons: Skip is first-class (submitting Step 1 is the happy path) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing Food Item...</span>
                    </>
                  ) : (
                    <>
                      <Utensils className="w-4 h-4" />
                      <span>{step2Open ? 'Analyze with Nutrition Facts' : 'Analyze Unpackaged Food'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footnote: Neutral one-line footnote */}
          <div className="px-3 py-2 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] text-xs text-[#5A6E62] flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#5A6E62] shrink-0" />
            <span>
              Manually entered items are not verified through Open Food Facts. Missing nutrients are shown as unavailable.
            </span>
          </div>
        </div>

        {/* Quick Templates Upgraded Sidebar */}
        <div className="lg:col-span-4 bg-white border border-[#E4EAE6] rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#111C16]">
              Common Unpackaged Items
            </h2>
            <p className="text-xs text-[#5A6E62] mt-0.5">
              Select an item to set name, category, and standard amount (nutritional facts are never pre-filled):
            </p>
          </div>

          {/* Search filter inside templates */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5A6E62] absolute left-3 top-2.5" />
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#15803D]"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {['All', 'Grains & Rice', 'Vegetables', 'Fruits', 'Meat & Poultry', 'Fish & Seafood', 'Dairy & Eggs'].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    templateCategoryFilter === cat
                      ? 'bg-[#15803D] text-white'
                      : 'bg-[#F4F7F5] text-[#5A6E62] hover:bg-[#E8EFEA]'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          {/* Template List */}
          <div className="divide-y divide-[#EDF2EE] max-h-[380px] overflow-y-auto pr-1">
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-[#5A6E62] py-4 text-center">No matching items</p>
            ) : (
              filteredTemplates.map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  onClick={() => handleSelectTemplate(ex)}
                  className="w-full py-2.5 text-left hover:bg-[#F8FAF9] px-2 -mx-2 rounded-md transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-medium text-[#111C16] group-hover:text-[#15803D]">
                      {ex.name}
                    </p>
                    <p className="text-[10px] text-[#5A6E62]">
                      {ex.category} · Default: {ex.defaultAmount} {ex.defaultUnit}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#15803D] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    + Fill
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
