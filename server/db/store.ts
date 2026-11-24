import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  FamilyMemberModel,
  FamilyModel,
  MonthlyBudgetModel,
  PurchaseHistoryModel,
  UserModel,
} from '../models/schemas.ts';
import type {
  FamilyMemberRecord,
  FamilyRecord,
  MonthlyBudgetRecord,
  PurchaseRecord,
  UserRecord,
} from '../types.ts';

interface LocalDatabaseFile {
  users: UserRecord[];
  families: FamilyRecord[];
  familyMembers: FamilyMemberRecord[];
  purchases: PurchaseRecord[];
  monthlyBudgets: MonthlyBudgetRecord[];
}

const DATA_FILE_PATH = path.resolve(process.cwd(), '.nutritrack-local-db.json');

let storageMode: 'mongodb' | 'local_fallback' = 'local_fallback';
let connectionNotice = 'Using local JSON store (configure MONGODB_URI to connect to MongoDB Atlas/local MongoDB).';

function newObjectIdHex(): string {
  return crypto.randomBytes(12).toString('hex');
}

function readLocalFile(): LocalDatabaseFile {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      return { users: [], families: [], familyMembers: [], purchases: [], monthlyBudgets: [] };
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseFile>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      families: Array.isArray(parsed.families) ? parsed.families : [],
      familyMembers: Array.isArray(parsed.familyMembers) ? parsed.familyMembers : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      monthlyBudgets: Array.isArray(parsed.monthlyBudgets) ? parsed.monthlyBudgets : [],
    };
  } catch {
    return { users: [], families: [], familyMembers: [], purchases: [], monthlyBudgets: [] };
  }
}

function writeLocalFile(data: LocalDatabaseFile): void {
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function initializeDatabase(): Promise<{
  mode: 'mongodb' | 'local_fallback';
  notice: string;
}> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    storageMode = 'local_fallback';
    connectionNotice = 'MONGODB_URI is not set. Running with persistent local JSON store (Mongoose schemas ready).';
    return { mode: storageMode, notice: connectionNotice };
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    storageMode = 'mongodb';
    connectionNotice = 'Connected to MongoDB via Mongoose.';
    return { mode: storageMode, notice: connectionNotice };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown connection error';
    storageMode = 'local_fallback';
    connectionNotice = `MongoDB connection unavailable (${msg}). Running with persistent local JSON store.`;
    return { mode: storageMode, notice: connectionNotice };
  }
}

export function getStorageStatus() {
  return { mode: storageMode, notice: connectionNotice };
}

function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export const db = {
  users: {
    async findByEmail(email: string): Promise<UserRecord | null> {
      const normalized = email.trim().toLowerCase();
      if (storageMode === 'mongodb') {
        const doc = await UserModel.findOne({ email: normalized }).lean();
        if (!doc) return null;
        return {
          id: String(doc._id),
          name: doc.name,
          email: doc.email,
          passwordHash: doc.passwordHash,
          currency: doc.currency || 'USD',
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      return data.users.find((u) => u.email === normalized) ?? null;
    },

    async findById(id: string): Promise<UserRecord | null> {
      if (!isValidObjectId(id)) return null;
      if (storageMode === 'mongodb') {
        const doc = await UserModel.findById(id).lean();
        if (!doc) return null;
        return {
          id: String(doc._id),
          name: doc.name,
          email: doc.email,
          passwordHash: doc.passwordHash,
          currency: doc.currency || 'USD',
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      return data.users.find((u) => u.id === id) ?? null;
    },

    async create(input: { name: string; email: string; passwordHash: string; currency?: string }): Promise<UserRecord> {
      const normalized = input.email.trim().toLowerCase();
      if (storageMode === 'mongodb') {
        const doc = await UserModel.create({
          name: input.name.trim(),
          email: normalized,
          passwordHash: input.passwordHash,
          currency: input.currency || 'USD',
        });
        return {
          id: String(doc._id),
          name: doc.name,
          email: doc.email,
          passwordHash: doc.passwordHash,
          currency: doc.currency,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const now = new Date().toISOString();
      const record: UserRecord = {
        id: newObjectIdHex(),
        name: input.name.trim(),
        email: normalized,
        passwordHash: input.passwordHash,
        currency: input.currency || 'USD',
        createdAt: now,
        updatedAt: now,
      };
      data.users.push(record);
      writeLocalFile(data);
      return record;
    },

    async update(id: string, updates: Partial<Pick<UserRecord, 'name' | 'currency' | 'passwordHash'>>): Promise<UserRecord | null> {
      if (!isValidObjectId(id)) return null;
      if (storageMode === 'mongodb') {
        const doc = await UserModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
        if (!doc) return null;
        return {
          id: String(doc._id),
          name: doc.name,
          email: doc.email,
          passwordHash: doc.passwordHash,
          currency: doc.currency || 'USD',
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const idx = data.users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      data.users[idx] = { ...data.users[idx], ...updates, updatedAt: new Date().toISOString() };
      writeLocalFile(data);
      return data.users[idx];
    },
  },

  families: {
    async listByUser(userId: string): Promise<FamilyRecord[]> {
      if (!isValidObjectId(userId)) return [];
      if (storageMode === 'mongodb') {
        const docs = await FamilyModel.find({ userId }).sort({ createdAt: 1 }).lean();
        return docs.map((d) => ({
          id: String(d._id),
          userId: String(d.userId),
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }));
      }
      const data = readLocalFile();
      return data.families.filter((f) => f.userId === userId);
    },

    async findOwnedById(id: string, userId: string): Promise<FamilyRecord | null> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return null;
      if (storageMode === 'mongodb') {
        const d = await FamilyModel.findOne({ _id: id, userId }).lean();
        if (!d) return null;
        return {
          id: String(d._id),
          userId: String(d.userId),
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      return data.families.find((f) => f.id === id && f.userId === userId) ?? null;
    },

    async create(userId: string, name: string): Promise<FamilyRecord> {
      if (storageMode === 'mongodb') {
        const d = await FamilyModel.create({ userId, name: name.trim() });
        return {
          id: String(d._id),
          userId: String(d.userId),
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const now = new Date().toISOString();
      const rec: FamilyRecord = {
        id: newObjectIdHex(),
        userId,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      };
      data.families.push(rec);
      writeLocalFile(data);
      return rec;
    },

    async updateOwned(id: string, userId: string, name: string): Promise<FamilyRecord | null> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return null;
      if (storageMode === 'mongodb') {
        const d = await FamilyModel.findOneAndUpdate(
          { _id: id, userId },
          { $set: { name: name.trim() } },
          { new: true }
        ).lean();
        if (!d) return null;
        return {
          id: String(d._id),
          userId: String(d.userId),
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const idx = data.families.findIndex((f) => f.id === id && f.userId === userId);
      if (idx === -1) return null;
      data.families[idx] = { ...data.families[idx], name: name.trim(), updatedAt: new Date().toISOString() };
      writeLocalFile(data);
      return data.families[idx];
    },

    async deleteOwned(id: string, userId: string): Promise<boolean> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return false;
      if (storageMode === 'mongodb') {
        const res = await FamilyModel.deleteOne({ _id: id, userId });
        if (res.deletedCount > 0) {
          await FamilyMemberModel.deleteMany({ familyId: id, userId });
          return true;
        }
        return false;
      }
      const data = readLocalFile();
      const before = data.families.length;
      data.families = data.families.filter((f) => !(f.id === id && f.userId === userId));
      if (data.families.length === before) return false;
      data.familyMembers = data.familyMembers.filter((m) => !(m.familyId === id && m.userId === userId));
      writeLocalFile(data);
      return true;
    },
  },

  familyMembers: {
    async listByUser(userId: string, familyId?: string): Promise<FamilyMemberRecord[]> {
      if (!isValidObjectId(userId)) return [];
      if (storageMode === 'mongodb') {
        const filter: Record<string, string> = { userId };
        if (familyId && isValidObjectId(familyId)) filter.familyId = familyId;
        const docs = await FamilyMemberModel.find(filter).sort({ createdAt: 1 }).lean();
        return docs.map((d) => ({
          id: String(d._id),
          familyId: String(d.familyId),
          userId: String(d.userId),
          name: d.name,
          age: d.age ?? null,
          allergies: d.allergies ?? [],
          dietaryRestrictions: d.dietaryRestrictions ?? [],
          foodsToAvoid: d.foodsToAvoid ?? [],
          nutritionalPreferences: d.nutritionalPreferences ?? [],
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }));
      }
      const data = readLocalFile();
      return data.familyMembers.filter(
        (m) => m.userId === userId && (!familyId || m.familyId === familyId)
      );
    },

    async findOwnedById(id: string, userId: string): Promise<FamilyMemberRecord | null> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return null;
      if (storageMode === 'mongodb') {
        const d = await FamilyMemberModel.findOne({ _id: id, userId }).lean();
        if (!d) return null;
        return {
          id: String(d._id),
          familyId: String(d.familyId),
          userId: String(d.userId),
          name: d.name,
          age: d.age ?? null,
          allergies: d.allergies ?? [],
          dietaryRestrictions: d.dietaryRestrictions ?? [],
          foodsToAvoid: d.foodsToAvoid ?? [],
          nutritionalPreferences: d.nutritionalPreferences ?? [],
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      return data.familyMembers.find((m) => m.id === id && m.userId === userId) ?? null;
    },

    async create(input: Omit<FamilyMemberRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<FamilyMemberRecord> {
      if (storageMode === 'mongodb') {
        const d = await FamilyMemberModel.create(input);
        return {
          id: String(d._id),
          familyId: String(d.familyId),
          userId: String(d.userId),
          name: d.name,
          age: d.age ?? null,
          allergies: d.allergies ?? [],
          dietaryRestrictions: d.dietaryRestrictions ?? [],
          foodsToAvoid: d.foodsToAvoid ?? [],
          nutritionalPreferences: d.nutritionalPreferences ?? [],
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const now = new Date().toISOString();
      const rec: FamilyMemberRecord = {
        ...input,
        id: newObjectIdHex(),
        createdAt: now,
        updatedAt: now,
      };
      data.familyMembers.push(rec);
      writeLocalFile(data);
      return rec;
    },

    async updateOwned(
      id: string,
      userId: string,
      updates: Partial<Pick<FamilyMemberRecord, 'name' | 'age' | 'allergies' | 'dietaryRestrictions' | 'foodsToAvoid' | 'nutritionalPreferences' | 'familyId'>>
    ): Promise<FamilyMemberRecord | null> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return null;
      if (storageMode === 'mongodb') {
        const d = await FamilyMemberModel.findOneAndUpdate(
          { _id: id, userId },
          { $set: updates },
          { new: true }
        ).lean();
        if (!d) return null;
        return {
          id: String(d._id),
          familyId: String(d.familyId),
          userId: String(d.userId),
          name: d.name,
          age: d.age ?? null,
          allergies: d.allergies ?? [],
          dietaryRestrictions: d.dietaryRestrictions ?? [],
          foodsToAvoid: d.foodsToAvoid ?? [],
          nutritionalPreferences: d.nutritionalPreferences ?? [],
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const idx = data.familyMembers.findIndex((m) => m.id === id && m.userId === userId);
      if (idx === -1) return null;
      data.familyMembers[idx] = {
        ...data.familyMembers[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      writeLocalFile(data);
      return data.familyMembers[idx];
    },

    async deleteOwned(id: string, userId: string): Promise<boolean> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return false;
      if (storageMode === 'mongodb') {
        const res = await FamilyMemberModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      const data = readLocalFile();
      const before = data.familyMembers.length;
      data.familyMembers = data.familyMembers.filter((m) => !(m.id === id && m.userId === userId));
      if (data.familyMembers.length === before) return false;
      writeLocalFile(data);
      return true;
    },
  },

  purchases: {
    async listByUser(userId: string, familyId?: string): Promise<PurchaseRecord[]> {
      if (!isValidObjectId(userId)) return [];
      if (storageMode === 'mongodb') {
        const filter: Record<string, string> = { userId };
        if (familyId && isValidObjectId(familyId)) filter.familyId = familyId;
        const docs = await PurchaseHistoryModel.find(filter).sort({ purchasedAt: -1 }).lean();
        return docs.map((d) => ({
          id: String(d._id),
          userId: String(d.userId),
          familyId: String(d.familyId),
          familyMemberId: d.familyMemberId ? String(d.familyMemberId) : null,
          familyMemberName: d.familyMemberName ?? null,
          barcode: d.barcode ?? null,
          productName: d.productName,
          brand: d.brand ?? null,
          category: d.category || 'Uncategorized',
          source: d.source,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          totalPrice: d.totalPrice,
          nutriScore: d.nutriScore ?? null,
          purchasedAt: d.purchasedAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
        }));
      }
      const data = readLocalFile();
      return data.purchases
        .filter((p) => p.userId === userId && (!familyId || p.familyId === familyId))
        .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
    },

    async create(input: Omit<PurchaseRecord, 'id' | 'createdAt'>): Promise<PurchaseRecord> {
      if (storageMode === 'mongodb') {
        const d = await PurchaseHistoryModel.create({
          ...input,
          purchasedAt: new Date(input.purchasedAt),
        });
        return {
          id: String(d._id),
          userId: String(d.userId),
          familyId: String(d.familyId),
          familyMemberId: d.familyMemberId ? String(d.familyMemberId) : null,
          familyMemberName: d.familyMemberName ?? null,
          barcode: d.barcode ?? null,
          productName: d.productName,
          brand: d.brand ?? null,
          category: d.category || 'Uncategorized',
          source: d.source,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          totalPrice: d.totalPrice,
          nutriScore: d.nutriScore ?? null,
          purchasedAt: d.purchasedAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const rec: PurchaseRecord = {
        ...input,
        id: newObjectIdHex(),
        createdAt: new Date().toISOString(),
      };
      data.purchases.push(rec);
      writeLocalFile(data);
      return rec;
    },

    async deleteOwned(id: string, userId: string): Promise<boolean> {
      if (!isValidObjectId(id) || !isValidObjectId(userId)) return false;
      if (storageMode === 'mongodb') {
        const res = await PurchaseHistoryModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      const data = readLocalFile();
      const before = data.purchases.length;
      data.purchases = data.purchases.filter((p) => !(p.id === id && p.userId === userId));
      if (data.purchases.length === before) return false;
      writeLocalFile(data);
      return true;
    },
  },

  budgets: {
    async listByUser(userId: string, familyId?: string): Promise<MonthlyBudgetRecord[]> {
      if (!isValidObjectId(userId)) return [];
      if (storageMode === 'mongodb') {
        const filter: Record<string, string> = { userId };
        if (familyId && isValidObjectId(familyId)) filter.familyId = familyId;
        const docs = await MonthlyBudgetModel.find(filter).sort({ month: -1 }).lean();
        return docs.map((d) => ({
          id: String(d._id),
          userId: String(d.userId),
          familyId: String(d.familyId),
          month: d.month,
          budgetLimit: d.budgetLimit,
          currency: d.currency || 'USD',
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }));
      }
      const data = readLocalFile();
      return data.monthlyBudgets
        .filter((b) => b.userId === userId && (!familyId || b.familyId === familyId))
        .sort((a, b) => b.month.localeCompare(a.month));
    },

    async upsert(input: {
      userId: string;
      familyId: string;
      month: string;
      budgetLimit: number;
      currency: string;
    }): Promise<MonthlyBudgetRecord> {
      if (storageMode === 'mongodb') {
        const d = await MonthlyBudgetModel.findOneAndUpdate(
          { userId: input.userId, familyId: input.familyId, month: input.month },
          { $set: { budgetLimit: input.budgetLimit, currency: input.currency } },
          { upsert: true, new: true }
        ).lean();
        return {
          id: String(d!._id),
          userId: String(d!.userId),
          familyId: String(d!.familyId),
          month: d!.month,
          budgetLimit: d!.budgetLimit,
          currency: d!.currency || 'USD',
          createdAt: d!.createdAt.toISOString(),
          updatedAt: d!.updatedAt.toISOString(),
        };
      }
      const data = readLocalFile();
      const now = new Date().toISOString();
      const idx = data.monthlyBudgets.findIndex(
        (b) => b.userId === input.userId && b.familyId === input.familyId && b.month === input.month
      );
      if (idx !== -1) {
        data.monthlyBudgets[idx] = {
          ...data.monthlyBudgets[idx],
          budgetLimit: input.budgetLimit,
          currency: input.currency,
          updatedAt: now,
        };
        writeLocalFile(data);
        return data.monthlyBudgets[idx];
      }
      const rec: MonthlyBudgetRecord = {
        id: newObjectIdHex(),
        userId: input.userId,
        familyId: input.familyId,
        month: input.month,
        budgetLimit: input.budgetLimit,
        currency: input.currency,
        createdAt: now,
        updatedAt: now,
      };
      data.monthlyBudgets.push(rec);
      writeLocalFile(data);
      return rec;
    },
  },
};
