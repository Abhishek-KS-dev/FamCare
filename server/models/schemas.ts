import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IUserDoc extends Document {
  name: string;
  email: string;
  passwordHash: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: 'USD', maxlength: 10 },
  },
  { timestamps: true }
);

export interface IFamilyDoc extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const FamilySchema = new Schema<IFamilyDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

export interface IFamilyMemberDoc extends Document {
  familyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  age: number | null;
  allergies: string[];
  dietaryRestrictions: string[];
  foodsToAvoid: string[];
  nutritionalPreferences: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMemberSchema = new Schema<IFamilyMemberDoc>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    age: { type: Number, default: null, min: 0, max: 130 },
    allergies: { type: [String], default: [] },
    dietaryRestrictions: { type: [String], default: [] },
    foodsToAvoid: { type: [String], default: [] },
    nutritionalPreferences: { type: [String], default: [] },
  },
  { timestamps: true }
);

export interface IPurchaseHistoryDoc extends Document {
  userId: mongoose.Types.ObjectId;
  familyId: mongoose.Types.ObjectId;
  familyMemberId: mongoose.Types.ObjectId | null;
  familyMemberName: string | null;
  barcode: string | null;
  productName: string;
  brand: string | null;
  category: string;
  source: 'open_food_facts' | 'ocr_verified' | 'manual_entry';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  nutriScore: string | null;
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseHistorySchema = new Schema<IPurchaseHistoryDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
    familyMemberName: { type: String, default: null, maxlength: 80 },
    barcode: { type: String, default: null, maxlength: 32 },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    brand: { type: String, default: null, maxlength: 120 },
    category: { type: String, default: 'Uncategorized', maxlength: 120 },
    source: {
      type: String,
      enum: ['open_food_facts', 'ocr_verified', 'manual_entry'],
      default: 'open_food_facts',
    },
    quantity: { type: Number, required: true, min: 0.01, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    nutriScore: { type: String, default: null, maxlength: 5 },
    purchasedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export interface IMonthlyBudgetDoc extends Document {
  userId: mongoose.Types.ObjectId;
  familyId: mongoose.Types.ObjectId;
  month: string;
  budgetLimit: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyBudgetSchema = new Schema<IMonthlyBudgetDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    budgetLimit: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', maxlength: 10 },
  },
  { timestamps: true }
);

MonthlyBudgetSchema.index({ userId: 1, familyId: 1, month: 1 }, { unique: true });

export const UserModel: Model<IUserDoc> =
  (mongoose.models.User as Model<IUserDoc>) || mongoose.model<IUserDoc>('User', UserSchema);

export const FamilyModel: Model<IFamilyDoc> =
  (mongoose.models.Family as Model<IFamilyDoc>) || mongoose.model<IFamilyDoc>('Family', FamilySchema);

export const FamilyMemberModel: Model<IFamilyMemberDoc> =
  (mongoose.models.FamilyMember as Model<IFamilyMemberDoc>) ||
  mongoose.model<IFamilyMemberDoc>('FamilyMember', FamilyMemberSchema);

export const PurchaseHistoryModel: Model<IPurchaseHistoryDoc> =
  (mongoose.models.PurchaseHistory as Model<IPurchaseHistoryDoc>) ||
  mongoose.model<IPurchaseHistoryDoc>('PurchaseHistory', PurchaseHistorySchema);

export const MonthlyBudgetModel: Model<IMonthlyBudgetDoc> =
  (mongoose.models.MonthlyBudget as Model<IMonthlyBudgetDoc>) ||
  mongoose.model<IMonthlyBudgetDoc>('MonthlyBudget', MonthlyBudgetSchema);
