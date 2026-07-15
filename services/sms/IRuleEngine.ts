import { ParsedSms } from './ISmsParser';

export interface RuleMatchResult {
  matchedAccountId: string | null;
  matchedCategoryId: string | null;
  matchedRuleId: string | null;
  confidence: number; // 0-100
  autoSave: boolean;
  preFill: boolean;
  needsReview: boolean;
}

export interface IRuleEngine {
  applyRules(parsed: ParsedSms): Promise<RuleMatchResult>;
  learnFromDecision(
    tempTx: any, 
    decision: 'accepted' | 'edited' | 'rejected' | 'skipped', 
    categoryId?: string, 
    accountId?: string
  ): Promise<void>;
}
