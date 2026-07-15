import { SmsRepository } from '../../db/repositories';

export interface IAccountMatcher {
  matchAccount(bankName: string, last4: string): Promise<string | null>;
}

export class AccountMatcher implements IAccountMatcher {
  async matchAccount(bankName: string, last4: string): Promise<string | null> {
    const rule = await SmsRepository.findRuleByAccount(bankName, last4);
    if (rule && rule.preferredAccountId) {
      return rule.preferredAccountId;
    }
    return null;
  }
}
