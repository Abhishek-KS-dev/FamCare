import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai';
import type {
  AgentAnalysisReport,
  AgentComparisonReport,
  AgentToolLog,
  AlternativeSearchResult,
  FamilyCompatibilityResult,
  FamilyMemberRecord,
  IngredientAnalysisResult,
  NutritionalAnalysisResult,
  ProductComparisonItem,
  ProductData,
} from '../types.ts';
import {
  analyzeIngredientsAndAllergens,
  analyzeNutrition,
  checkFamilyCompatibilityDeterministic,
  deriveAlternativeSearchTerms,
  evaluateAlternativeCandidates,
} from './deterministicRules.ts';
import { fetchProductByBarcode, searchOpenFoodFactsProducts } from './openFoodFacts.ts';

const AGENT_MODEL = 'gemini-4-hydrogen';
const MAX_TOOL_CALLS = 8;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Five Tool Declarations for the Central Food Intelligence Agent
const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'interpret_natural_language_entry',
    description:
      'Extract food name, category, and approximate quantity from unstructured raw user entry text (e.g. "a handful of almonds", "a bunch of spinach", "one bowl of oatmeal"). Call this first when rawEntryText is present.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Cleaned food item name (e.g., "Almonds", "Fresh Spinach", "Oatmeal").',
        },
        category: {
          type: Type.STRING,
          description:
            'Best fitting unpackaged food category: Vegetables, Fruits, Grains & Rice, Meat & Poultry, Fish & Seafood, Dairy & Eggs, Sugar & Sweeteners, Legumes & Pulses, Nuts & Seeds, Herbs & Spices, or Other Unpackaged Food.',
        },
        quantity: {
          type: Type.STRING,
          description: 'Approximate or interpreted quantity/portion (e.g., "1 handful (~30g)", "1 bunch", "1 bowl").',
        },
        reason: {
          type: Type.STRING,
          description: 'Rationale for extracted food details.',
        },
      },
      required: ['name', 'category', 'reason'],
    },
  },
  {
    name: 'retrieve_product_info',
    description:
      'TOOL 1: Retrieve structured food product details from Open Food Facts using a barcode number, or inspect currently provided product information and identify missing fields.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        barcode: {
          type: Type.STRING,
          description: 'Numeric product barcode to look up in Open Food Facts.',
        },
        reason: {
          type: Type.STRING,
          description: 'Short rationale for invoking this tool.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'analyze_ingredients_and_allergens',
    description:
      'TOOL 2: Run deterministic ingredient parsing, standard allergen detection, additive extraction, and incomplete-ingredient flagging on the active product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: 'Short rationale for invoking this tool.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'analyze_nutrition',
    description:
      'TOOL 3: Evaluate available per-100g nutritional values (energy, sugar, protein, fat, saturated fat, carbs, sodium, fiber) against deterministic thresholds and flag missing nutrients.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: 'Short rationale for invoking this tool.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'check_family_compatibility',
    description:
      'TOOL 4: Execute privacy-preserving deterministic backend checks comparing the active product against the selected family member health profile. Never returns private health profile text—returns only anonymized compatibility status and conflict counts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: 'Short rationale for invoking this tool.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'recommend_alternatives',
    description:
      'TOOL 5: Search Open Food Facts for real alternative products in a similar food category, deterministically filter out conflicting candidates for the selected family member, flag missing ingredients, and rank healthier options. Invoke this when a compatibility conflict or high nutritional concern is detected, or when alternatives were explicitly requested.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        searchQuery: {
          type: Type.STRING,
          description:
            'Optional concise food category or product type query for Open Food Facts (e.g., "chocolate biscuits", "oat cereal", "fruit yogurt").',
        },
        reason: {
          type: Type.STRING,
          description: 'Short rationale for invoking this tool.',
        },
      },
      required: ['reason'],
    },
  },
];

const AGENT_SYSTEM_INSTRUCTION = `You are the central Food Intelligence Agent inside FamCare.
Your role is to autonomously coordinate the backend food-analysis tools to produce an accurate, grounded, privacy-safe analysis report.

STRICT OPERATIONAL RULES:
1. You NEVER invent ingredients, nutritional values, or allergens. You rely strictly on tool responses. Missing nutritional values must remain missing and be reported as unavailable.
2. You NEVER make medical diagnoses or override deterministic allergy/compatibility results.
3. Privacy guarantee: You never see private family health profiles; tool 4 runs deterministically on the backend and returns anonymized status flags.
4. Natural Language Entry:
   - When rawEntryText is present in the task context, call interpret_natural_language_entry first to extract/confirm the food name, category, and approximate quantity before proceeding with analysis tools.
5. Autonomous conditional workflow:
   - For a barcode task: call retrieve_product_info first. If productFound is false, STOP calling analysis tools and advise the user to use OCR Label Scanner or Manual Entry.
   - If product data is already supplied (OCR-verified or Manual Entry), inspect its fields and call analyze_ingredients_and_allergens (when ingredients exist or need flagging) and analyze_nutrition (when nutrition exists or needs missing-data reporting).
   - If hasSelectedFamilyMember is true, call check_family_compatibility.
   - Call recommend_alternatives ONLY when: (a) check_family_compatibility returns CONFLICT, OR (b) analyze_nutrition flags major high-threshold concerns and alternatives are helpful, OR (c) requestAlternatives is explicitly true. Do NOT wastefully call recommend_alternatives for a missing product or unpackaged single-ingredient raw foods unless there is a conflict or user requested alternatives.
   - If ingredients are missing on a packaged barcode product, clearly note that OCR label scanning or manual correction is needed.
6. Keep your final response concise (3–5 clear sentences in plain prose, no markdown headings or bullet clutter): summarize the product findings, missing information warnings, whether any compatibility conflicts occurred (without inventing details you weren't given), and whether alternatives were retrieved.`;

export interface RunAgentAnalysisInput {
  taskType: 'barcode_analysis' | 'ocr_analysis' | 'manual_analysis';
  barcode?: string | null;
  providedProduct?: ProductData | null;
  familyMember: FamilyMemberRecord | null;
  requestAlternatives?: boolean;
  rawEntryText?: string | null;
}

interface AgentExecutionState {
  product: ProductData | null;
  productFound: boolean;
  ingredientAnalysis: IngredientAnalysisResult | null;
  nutritionalAnalysis: NutritionalAnalysisResult | null;
  familyCompatibility: FamilyCompatibilityResult | null;
  alternatives: AlternativeSearchResult | null;
  executionLogs: AgentToolLog[];
}

async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  input: RunAgentAnalysisInput,
  state: AgentExecutionState
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  const reason = typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : `Execute ${toolName}`;

  const recordLog = (
    status: 'success' | 'warning' | 'error',
    inputSummary: Record<string, unknown>,
    outputSummary: Record<string, unknown>
  ) => {
    state.executionLogs.push({
      step: state.executionLogs.length + 1,
      toolName,
      reason,
      inputSummary,
      outputSummary,
      durationMs: Math.max(1, Date.now() - startedAt),
      status,
    });
  };

  if (toolName === 'interpret_natural_language_entry') {
    const rawName = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : (state.product?.name || '');
    const rawCategory = typeof args.category === 'string' && args.category.trim() ? args.category.trim() : (state.product?.category || 'Other Unpackaged Food');
    const rawQuantity = typeof args.quantity === 'string' && args.quantity.trim() ? args.quantity.trim() : (state.product?.quantity || null);

    if (state.product) {
      state.product.name = rawName || state.product.name;
      state.product.category = rawCategory || state.product.category;
      state.product.categoriesTags = [state.product.category?.toLowerCase() || 'other unpackaged food'];
      state.product.quantity = rawQuantity;
      if (!state.product.ingredientsText || state.product.ingredientsText === state.product.name) {
        state.product.ingredientsText = state.product.name;
      }
    }
    const out = {
      interpretedName: rawName,
      interpretedCategory: rawCategory,
      interpretedQuantity: rawQuantity,
      status: 'interpreted',
    };
    recordLog('success', { rawEntryText: input.rawEntryText }, out);
    return out;
  }

  if (toolName === 'retrieve_product_info') {
    const barcode = (typeof args.barcode === 'string' ? args.barcode : input.barcode || '').trim();
    if (barcode) {
      const lookup = await fetchProductByBarcode(barcode);
      if (lookup.found && lookup.product) {
        state.product = lookup.product;
        state.productFound = true;
        const out = {
          productFound: true,
          source: 'open_food_facts',
          name: lookup.product.name,
          brand: lookup.product.brand,
          category: lookup.product.category,
          hasIngredients: Boolean(lookup.product.ingredientsText),
          hasAnyNutriments: Object.values(lookup.product.nutriments).some((v) => v !== null),
          nutriScore: lookup.product.nutriScore,
          missingFields: lookup.product.missingFields,
        };
        recordLog(lookup.product.missingFields.length > 0 ? 'warning' : 'success', { barcode }, out);
        return out;
      }

      state.productFound = false;
      const out = {
        productFound: false,
        error: lookup.error || 'Product not found in Open Food Facts database.',
        recommendedNextStep: 'Use OCR Label Scanner or Manual Food Entry.',
      };
      recordLog('warning', { barcode }, out);
      return out;
    }

    if (state.product) {
      const out = {
        productFound: true,
        source: state.product.source,
        name: state.product.name,
        hasIngredients: Boolean(state.product.ingredientsText),
        missingFields: state.product.missingFields,
      };
      recordLog('success', { mode: state.product.source }, out);
      return out;
    }

    const out = { productFound: false, error: 'No barcode or product payload provided.' };
    recordLog('error', {}, out);
    return out;
  }

  if (toolName === 'analyze_ingredients_and_allergens') {
    if (!state.product) {
      const out = { error: 'Cannot analyze ingredients because no product is loaded.' };
      recordLog('error', {}, out);
      return out;
    }
    const result = analyzeIngredientsAndAllergens(state.product);
    state.ingredientAnalysis = result;
    const out = {
      ingredientsAvailable: result.ingredientsAvailable,
      ingredientCount: result.parsedIngredients.length,
      detectedAllergens: result.detectedAllergens,
      detectedAdditivesCount: result.detectedAdditives.length,
      incompleteWarning: result.incompleteWarning,
    };
    recordLog(result.ingredientsAvailable ? 'success' : 'warning', { productName: state.product.name }, out);
    return out;
  }

  if (toolName === 'analyze_nutrition') {
    if (!state.product) {
      const out = { error: 'Cannot analyze nutrition because no product is loaded.' };
      recordLog('error', {}, out);
      return out;
    }
    const result = analyzeNutrition(state.product);
    state.nutritionalAnalysis = result;
    const out = {
      hasAnyNutritionData: result.hasAnyNutritionData,
      concernsCount: result.concerns.length,
      concerns: result.concerns,
      missingNutrients: result.missingNutrients,
    };
    recordLog(
      result.hasAnyNutritionData && result.missingNutrients.length === 0 ? 'success' : 'warning',
      { productName: state.product.name },
      out
    );
    return out;
  }

  if (toolName === 'check_family_compatibility') {
    if (!state.product) {
      const out = { error: 'No product loaded for compatibility check.' };
      recordLog('error', {}, out);
      return out;
    }
    if (!input.familyMember) {
      const out = { checked: false, message: 'No family member selected for this analysis.' };
      recordLog('warning', { memberSelected: false }, out);
      return out;
    }

    // Runs 100% deterministically on backend.
    // PRIVACY BARRIER: Return ONLY anonymized status/categories to Gemini—never send member name, age, or profile items.
    const fullResult = checkFamilyCompatibilityDeterministic(state.product, input.familyMember);
    state.familyCompatibility = fullResult;

    const anonymizedForGemini = {
      checked: true,
      status: fullResult.status,
      compatible: fullResult.compatible,
      conflictCount: fullResult.conflicts.length,
      conflictTypes: Array.from(new Set(fullResult.conflicts.map((c) => c.type))),
      incompleteIngredientWarning: !state.product.ingredientsText,
      shouldSearchAlternatives: fullResult.status === 'CONFLICT',
    };

    recordLog(
      fullResult.status === 'CONFLICT' ? 'warning' : 'success',
      { memberRef: 'authorized_selected_member' },
      anonymizedForGemini
    );
    return anonymizedForGemini;
  }

  if (toolName === 'recommend_alternatives') {
    if (!state.product) {
      const out = { error: 'No base product loaded to search alternatives.' };
      recordLog('error', {}, out);
      return out;
    }
    const query =
      typeof args.searchQuery === 'string' && args.searchQuery.trim().length >= 2
        ? args.searchQuery.trim()
        : deriveAlternativeSearchTerms(state.product);

    const searchRes = await searchOpenFoodFactsProducts(query, {
      categoryTag: state.product.category,
      pageSize: 22,
    });

    if (searchRes.error && searchRes.products.length === 0) {
      const out = { queryUsed: query, foundCount: 0, error: searchRes.error };
      recordLog('error', { query }, out);
      return out;
    }

    const evaluated = evaluateAlternativeCandidates(
      state.product,
      searchRes.products,
      input.familyMember,
      searchRes.queryUsed
    );
    state.alternatives = evaluated;

    const anonymizedSummary = {
      queryUsed: evaluated.queryUsed,
      candidatesEvaluated: evaluated.candidatesEvaluated,
      excludedDueToConflict: evaluated.excludedDueToConflict,
      flaggedIncompleteIngredients: evaluated.flaggedIncompleteIngredients,
      recommendedCount: evaluated.recommendations.length,
      topRecommendationNames: evaluated.recommendations.slice(0, 3).map((r) => r.name),
    };
    recordLog(
      evaluated.recommendations.length > 0 ? 'success' : 'warning',
      { queryUsed: query },
      anonymizedSummary
    );
    return anonymizedSummary;
  }

  const unknownOut = { error: `Unknown tool requested: ${toolName}` };
  recordLog('error', { toolName }, unknownOut);
  return unknownOut;
}

function buildDeterministicSummary(state: AgentExecutionState, memberSelected: boolean): string {
  if (!state.productFound || !state.product) {
    return 'This barcode could not be located in Open Food Facts. Please capture the package label with the OCR Label Scanner or enter the item manually.';
  }
  const parts: string[] = [];
  parts.push(
    `Completed analysis for ${state.product.name}${state.product.brand ? ` (${state.product.brand})` : ''}.`
  );

  if (state.ingredientAnalysis && !state.ingredientAnalysis.ingredientsAvailable) {
    parts.push(
      'Ingredient information is currently unavailable, so allergen screening is incomplete—verify the physical package or submit an OCR label scan.'
    );
  } else if (state.ingredientAnalysis && state.ingredientAnalysis.detectedAllergens.length > 0) {
    parts.push(`Detected standard allergen groups: ${state.ingredientAnalysis.detectedAllergens.join(', ')}.`);
  }

  if (state.familyCompatibility) {
    if (state.familyCompatibility.status === 'CONFLICT') {
      parts.push(
        `Deterministic family screening flagged ${state.familyCompatibility.conflicts.length} conflict(s) for ${state.familyCompatibility.memberName}.`
      );
    } else if (state.familyCompatibility.status === 'CAUTION_INCOMPLETE_DATA') {
      parts.push(
        `No conflicts matched available metadata for ${state.familyCompatibility.memberName}, but missing ingredients require manual package verification.`
      );
    } else {
      parts.push(
        `No registered conflicts were found in available ingredient data for ${state.familyCompatibility.memberName}.`
      );
    }
  } else if (!memberSelected) {
    parts.push('No family member profile was selected for compatibility screening.');
  }

  if (state.nutritionalAnalysis && state.nutritionalAnalysis.concerns.length > 0) {
    parts.push(`Nutritional concerns noted: ${state.nutritionalAnalysis.concerns.slice(0, 2).join(' ')}`);
  }

  if (state.alternatives) {
    parts.push(
      `Evaluated ${state.alternatives.candidatesEvaluated} Open Food Facts candidates and ranked ${state.alternatives.recommendations.length} potential alternative(s) (never guaranteed allergen-free without label check).`
    );
  }

  return parts.join(' ');
}

async function runDeterministicWorkflow(
  input: RunAgentAnalysisInput,
  state: AgentExecutionState
): Promise<void> {
  if (input.taskType === 'barcode_analysis' && !state.product) {
    await executeAgentTool(
      'retrieve_product_info',
      { barcode: input.barcode, reason: 'Retrieve product metadata from Open Food Facts by barcode.' },
      input,
      state
    );
  }

  if (!state.productFound || !state.product) {
    return;
  }

  await executeAgentTool(
    'analyze_ingredients_and_allergens',
    { reason: 'Inspect available ingredients, standard allergens, and missing-data flags.' },
    input,
    state
  );

  await executeAgentTool(
    'analyze_nutrition',
    { reason: 'Evaluate available per-100g nutrition values against transparent thresholds.' },
    input,
    state
  );

  if (input.familyMember) {
    await executeAgentTool(
      'check_family_compatibility',
      { reason: 'Run deterministic compatibility check against selected family member profile.' },
      input,
      state
    );
  }

  const hasConflict = state.familyCompatibility?.status === 'CONFLICT';
  const hasHighNutritionConcern = (state.nutritionalAnalysis?.concerns.length ?? 0) >= 2;
  const shouldRecommend =
    Boolean(input.requestAlternatives) ||
    hasConflict ||
    (state.product.source === 'open_food_facts' && hasHighNutritionConcern);

  if (shouldRecommend) {
    await executeAgentTool(
      'recommend_alternatives',
      {
        searchQuery: deriveAlternativeSearchTerms(state.product),
        reason: hasConflict
          ? 'Search Open Food Facts for alternatives after detecting a family compatibility conflict.'
          : 'Search Open Food Facts for nutritionally comparable alternatives.',
      },
      input,
      state
    );
  }
}

export async function runFoodIntelligenceAgent(input: RunAgentAnalysisInput): Promise<AgentAnalysisReport> {
  const state: AgentExecutionState = {
    product: input.providedProduct ?? null,
    productFound: Boolean(input.providedProduct),
    ingredientAnalysis: null,
    nutritionalAnalysis: null,
    familyCompatibility: null,
    alternatives: null,
    executionLogs: [],
  };

  let orchestrationMode: 'gemini_agent' | 'deterministic_fallback' = 'deterministic_fallback';
  let modelUsed: string | null = null;
  let geminiUnavailableReason: string | null = null;
  let agentSummary = '';

  const ai = getGeminiClient();

  if (ai) {
    try {
      const sanitizedTaskContext = {
        taskType: input.taskType,
        barcode: input.barcode || null,
        productPreloaded: Boolean(input.providedProduct),
        preloadedSummary: input.providedProduct
          ? {
              name: input.providedProduct.name,
              brand: input.providedProduct.brand,
              category: input.providedProduct.category,
              source: input.providedProduct.source,
              hasIngredients: Boolean(input.providedProduct.ingredientsText),
              hasAnyNutriments: Object.values(input.providedProduct.nutriments).some((v) => v !== null),
              missingFields: input.providedProduct.missingFields,
            }
          : null,
        hasSelectedFamilyMember: Boolean(input.familyMember),
        memberRef: input.familyMember ? 'authorized_selected_member' : null,
        requestAlternatives: Boolean(input.requestAlternatives),
        rawEntryText: input.rawEntryText || null,
      };

      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              text: `Coordinate the food analysis task using the available tools. Task payload:\n${JSON.stringify(
                sanitizedTaskContext,
                null,
                2
              )}`,
            },
          ],
        },
      ];

      let toolCallsUsed = 0;

      while (toolCallsUsed < MAX_TOOL_CALLS) {
        const response = await ai.models.generateContent({
          model: AGENT_MODEL,
          contents,
          config: {
            systemInstruction: AGENT_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
          },
        });

        const modelContent = response.candidates?.[0]?.content;
        const calls = response.functionCalls;

        if (!calls || calls.length === 0) {
          agentSummary = (response.text || '').trim();
          orchestrationMode = 'gemini_agent';
          modelUsed = AGENT_MODEL;
          break;
        }

        if (modelContent) {
          contents.push(modelContent);
        }

        const responseParts = [];
        for (const call of calls) {
          if (toolCallsUsed >= MAX_TOOL_CALLS) break;
          toolCallsUsed++;
          const toolResult = await executeAgentTool(
            call.name || '',
            (call.args as Record<string, unknown>) || {},
            input,
            state
          );
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name || 'unknown_tool',
              response: { result: toolResult },
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      }

      // Safety guardrail: Ensure deterministic checks were NOT skipped by the LLM when a product exists
      if (state.productFound && state.product) {
        if (!state.ingredientAnalysis) {
          await executeAgentTool(
            'analyze_ingredients_and_allergens',
            { reason: 'Mandatory deterministic safety check for ingredients and allergens.' },
            input,
            state
          );
        }
        if (!state.nutritionalAnalysis) {
          await executeAgentTool(
            'analyze_nutrition',
            { reason: 'Mandatory deterministic nutritional threshold evaluation.' },
            input,
            state
          );
        }
        if (input.familyMember && !state.familyCompatibility) {
          await executeAgentTool(
            'check_family_compatibility',
            { reason: 'Mandatory deterministic family compatibility safety check.' },
            input,
            state
          );
        }
        if (
          (state.familyCompatibility?.status === 'CONFLICT' || input.requestAlternatives) &&
          !state.alternatives
        ) {
          await executeAgentTool(
            'recommend_alternatives',
            {
              searchQuery: deriveAlternativeSearchTerms(state.product),
              reason: 'Retrieve Open Food Facts alternatives due to family conflict or explicit request.',
            },
            input,
            state
          );
        }
      }

      if (!agentSummary) {
        agentSummary = buildDeterministicSummary(state, Boolean(input.familyMember));
      }
      orchestrationMode = 'gemini_agent';
      modelUsed = AGENT_MODEL;
    } catch (err) {
      geminiUnavailableReason =
        err instanceof Error ? err.message : 'Gemini API call failed; executed deterministic backend workflow.';
      orchestrationMode = 'deterministic_fallback';
      modelUsed = null;
      if (state.executionLogs.length === 0) {
        await runDeterministicWorkflow(input, state);
      } else {
        // Complete any remaining required deterministic tools
        if (state.productFound && state.product) {
          if (!state.ingredientAnalysis) {
            await executeAgentTool('analyze_ingredients_and_allergens', { reason: 'Fallback ingredient check' }, input, state);
          }
          if (!state.nutritionalAnalysis) {
            await executeAgentTool('analyze_nutrition', { reason: 'Fallback nutrition check' }, input, state);
          }
          if (input.familyMember && !state.familyCompatibility) {
            await executeAgentTool('check_family_compatibility', { reason: 'Fallback family check' }, input, state);
          }
          if ((state.familyCompatibility?.status === 'CONFLICT' || input.requestAlternatives) && !state.alternatives) {
            await executeAgentTool('recommend_alternatives', { reason: 'Fallback alternatives search' }, input, state);
          }
        }
      }
      agentSummary = buildDeterministicSummary(state, Boolean(input.familyMember));
    }
  } else {
    geminiUnavailableReason =
      'GEMINI_API_KEY is not configured. Executed deterministic Food Intelligence Agent workflow.';
    await runDeterministicWorkflow(input, state);
    agentSummary = buildDeterministicSummary(state, Boolean(input.familyMember));
  }

  const missingInformationWarnings: string[] = [];
  if (state.product) {
    if (!state.product.ingredientsText) {
      missingInformationWarnings.push(
        'Ingredients list is unavailable. Scan the label via OCR or enter ingredients manually for full allergen checking.'
      );
    }
    if (state.nutritionalAnalysis && state.nutritionalAnalysis.missingNutrients.length > 0) {
      missingInformationWarnings.push(
        `Missing nutritional values: ${state.nutritionalAnalysis.missingNutrients.join(', ')}.`
      );
    }
    if (state.product.source === 'manual_entry') {
      missingInformationWarnings.push(
        'This item was manually entered and has NOT been verified through Open Food Facts.'
      );
    }
  }

  return {
    taskType: input.taskType,
    orchestrationMode,
    modelUsed,
    geminiUnavailableReason,
    productFound: state.productFound,
    product: state.product,
    ingredientAnalysis: state.ingredientAnalysis,
    nutritionalAnalysis: state.nutritionalAnalysis,
    familyCompatibility: state.familyCompatibility,
    alternatives: state.alternatives,
    needsOcrOrManualFallback: !state.productFound,
    needsManualCorrection: Boolean(state.product && !state.product.ingredientsText),
    missingInformationWarnings,
    agentSummary,
    executionLogs: state.executionLogs,
    timestamp: new Date().toISOString(),
  };
}

// Example 4: Product Comparison via the Food Intelligence Agent
export async function runFoodComparisonAgent(
  products: ProductData[],
  familyMember: FamilyMemberRecord | null
): Promise<AgentComparisonReport> {
  const executionLogs: AgentToolLog[] = [];
  const items: ProductComparisonItem[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const t1 = Date.now();
    const ingredientAnalysis = analyzeIngredientsAndAllergens(product);
    executionLogs.push({
      step: executionLogs.length + 1,
      toolName: 'analyze_ingredients_and_allergens',
      reason: `Inspect ingredients and allergens for comparison item ${i + 1}: ${product.name}`,
      inputSummary: { productName: product.name },
      outputSummary: {
        ingredientsAvailable: ingredientAnalysis.ingredientsAvailable,
        detectedAllergens: ingredientAnalysis.detectedAllergens,
      },
      durationMs: Math.max(1, Date.now() - t1),
      status: ingredientAnalysis.ingredientsAvailable ? 'success' : 'warning',
    });

    const t2 = Date.now();
    const nutritionalAnalysis = analyzeNutrition(product);
    executionLogs.push({
      step: executionLogs.length + 1,
      toolName: 'analyze_nutrition',
      reason: `Evaluate per-100g nutrition for comparison item ${i + 1}: ${product.name}`,
      inputSummary: { productName: product.name },
      outputSummary: {
        concernsCount: nutritionalAnalysis.concerns.length,
        missingNutrientsCount: nutritionalAnalysis.missingNutrients.length,
      },
      durationMs: Math.max(1, Date.now() - t2),
      status: nutritionalAnalysis.hasAnyNutritionData ? 'success' : 'warning',
    });

    let familyCompatibility: FamilyCompatibilityResult | null = null;
    if (familyMember) {
      const t3 = Date.now();
      familyCompatibility = checkFamilyCompatibilityDeterministic(product, familyMember);
      executionLogs.push({
        step: executionLogs.length + 1,
        toolName: 'check_family_compatibility',
        reason: `Compare item ${i + 1} (${product.name}) against selected family member profile`,
        inputSummary: { productName: product.name, memberRef: 'authorized_selected_member' },
        outputSummary: {
          status: familyCompatibility.status,
          conflictCount: familyCompatibility.conflicts.length,
        },
        durationMs: Math.max(1, Date.now() - t3),
        status: familyCompatibility.status === 'CONFLICT' ? 'warning' : 'success',
      });
    }

    items.push({ product, ingredientAnalysis, nutritionalAnalysis, familyCompatibility });
  }

  // Deterministic key differences across products
  const keyDifferences: string[] = [];
  const compareMetric = (
    label: string,
    unit: string,
    getter: (p: ProductData) => number | null,
    lowerIsBetter: boolean
  ) => {
    const valid = items
      .map((it) => ({ name: it.product.name, val: getter(it.product) }))
      .filter((x): x is { name: string; val: number } => x.val !== null);
    if (valid.length < 2) return;
    valid.sort((a, b) => a.val - b.val);
    const lowest = valid[0];
    const highest = valid[valid.length - 1];
    if (lowest.val !== highest.val) {
      keyDifferences.push(
        lowerIsBetter
          ? `${lowest.name} has the lowest ${label} (${lowest.val}${unit}), compared to ${highest.name} (${highest.val}${unit}).`
          : `${highest.name} provides the highest ${label} (${highest.val}${unit}), compared to ${lowest.name} (${lowest.val}${unit}).`
      );
    }
  };

  compareMetric('energy', ' kcal/100g', (p) => p.nutriments.energyKcal, true);
  compareMetric('sugars', 'g/100g', (p) => p.nutriments.sugars, true);
  compareMetric('protein', 'g/100g', (p) => p.nutriments.protein, false);
  compareMetric('total fat', 'g/100g', (p) => p.nutriments.fat, true);
  compareMetric('sodium', 'g/100g', (p) => p.nutriments.sodium, true);
  compareMetric('entered price', '', (p) => p.userPrice ?? null, true);

  if (familyMember) {
    const conflicting = items.filter((i) => i.familyCompatibility?.status === 'CONFLICT');
    const clear = items.filter((i) => i.familyCompatibility?.status === 'NO_KNOWN_CONFLICTS_FOUND');
    if (conflicting.length > 0) {
      keyDifferences.push(
        `${conflicting.map((c) => c.product.name).join(', ')} flagged compatibility conflict(s) for ${familyMember.name}.`
      );
    }
    if (clear.length > 0 && conflicting.length > 0) {
      keyDifferences.push(
        `${clear.map((c) => c.product.name).join(', ')} showed no detected conflicts in available ingredients (verify packaging).`
      );
    }
  }

  let orchestrationMode: 'gemini_agent' | 'deterministic_fallback' = 'deterministic_fallback';
  let modelUsed: string | null = null;
  let geminiUnavailableReason: string | null = null;
  let agentSummary =
    keyDifferences.length > 0
      ? keyDifferences.slice(0, 3).join(' ')
      : 'Comparison completed across selected products using available nutrition and ingredient data.';

  const ai = getGeminiClient();
  if (ai) {
    try {
      // Strictly anonymized comparison payload (zero private family health data sent to Gemini)
      const comparisonBrief = items.map((it) => ({
        name: it.product.name,
        brand: it.product.brand,
        nutriScore: it.product.nutriScore,
        energyKcal: it.product.nutriments.energyKcal,
        sugars: it.product.nutriments.sugars,
        protein: it.product.nutriments.protein,
        fat: it.product.nutriments.fat,
        sodium: it.product.nutriments.sodium,
        userPrice: it.product.userPrice ?? null,
        ingredientsAvailable: it.ingredientAnalysis.ingredientsAvailable,
        compatibilityStatus: it.familyCompatibility?.status ?? 'not_checked',
        conflictCount: it.familyCompatibility?.conflicts.length ?? 0,
      }));

      const resp = await ai.models.generateContent({
        model: AGENT_MODEL,
        contents: `Summarize the key nutritional, price, and anonymized compatibility differences across these products in 3–4 crisp sentences. Never invent unavailable values and never claim a product is guaranteed allergen-free.\n${JSON.stringify(
          comparisonBrief,
          null,
          2
        )}`,
      });
      if (resp.text?.trim()) {
        agentSummary = resp.text.trim();
        orchestrationMode = 'gemini_agent';
        modelUsed = AGENT_MODEL;
      }
    } catch (err) {
      geminiUnavailableReason =
        err instanceof Error ? err.message : 'Gemini unavailable; generated deterministic comparison summary.';
    }
  } else {
    geminiUnavailableReason = 'GEMINI_API_KEY not configured; generated deterministic comparison summary.';
  }

  return {
    orchestrationMode,
    modelUsed,
    geminiUnavailableReason,
    memberId: familyMember?.id ?? null,
    memberName: familyMember?.name ?? null,
    items,
    keyDifferences,
    agentSummary,
    executionLogs,
    timestamp: new Date().toISOString(),
  };
}
