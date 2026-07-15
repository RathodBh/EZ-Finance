import { SmsRepository } from '../../db/repositories';

export interface IMerchantMatcher {
  findRule(merchant: string, upiId?: string): Promise<any>;
  normalize(merchant: string): string;
}

export class MerchantMatcher implements IMerchantMatcher {
  async findRule(merchant: string, upiId?: string): Promise<any> {
    if (upiId) {
      const upiRule = await SmsRepository.findRuleByUpi(upiId);
      if (upiRule) return upiRule;
    }

    const normalizedName = this.normalize(merchant);
    if (!normalizedName) return null;

    // Direct match
    const rule = await SmsRepository.findRuleByMerchant(normalizedName);
    if (rule) return rule;

    // Fuzzy contains match across all merchant patterns
    const allRules = await SmsRepository.getRules();
    const merchantRules = allRules.filter((r: any) => r.ruleType === 'MERCHANT' && r.merchantPattern);
    
    for (const r of merchantRules) {
      const pattern = r.merchantPattern!.toLowerCase();
      if (normalizedName.toLowerCase().includes(pattern) || pattern.includes(normalizedName.toLowerCase())) {
        return r;
      }
    }

    return null;
  }

  normalize(merchant: string): string {
    return merchant
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // remove punctuation
      .trim();
  }
}
