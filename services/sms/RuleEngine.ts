import { IRuleEngine, RuleMatchResult } from './IRuleEngine';
import { ParsedSms } from './ISmsParser';
import { SmsRepository } from '../../db/repositories';
import { uuid } from '../utils';

export class RuleEngine implements IRuleEngine {
  async applyRules(parsed: ParsedSms): Promise<RuleMatchResult> {
    const settings = await SmsRepository.getSettings();
    const result: RuleMatchResult = {
      matchedAccountId: null,
      matchedCategoryId: null,
      matchedRuleId: null,
      confidence: 0,
      autoSave: false,
      preFill: false,
      needsReview: true,
    };

    // 1. MATCH ACCOUNT (Bank + Last 4)
    if (parsed.bankName && parsed.accountLast4) {
      const acctRule = await SmsRepository.findRuleByAccount(parsed.bankName, parsed.accountLast4);
      if (acctRule && acctRule.isEnabled && acctRule.preferredAccountId) {
        result.matchedAccountId = acctRule.preferredAccountId;
      }
    }

    // 2. MATCH BY UPI ID (High precision for digital transactions)
    let matchedRule: any = null;
    if (parsed.upiId) {
      const upiRule = await SmsRepository.findRuleByUpi(parsed.upiId);
      if (upiRule && upiRule.isEnabled) {
        matchedRule = upiRule;
      }
    }

    // 3. MATCH BY MERCHANT
    if (!matchedRule && parsed.merchant) {
      const merchantRule = await SmsRepository.findRuleByMerchant(parsed.merchant);
      if (merchantRule && merchantRule.isEnabled) {
        matchedRule = merchantRule;
      }
    }

    // Apply rule category & account choices
    if (matchedRule) {
      result.matchedRuleId = matchedRule.id;
      result.confidence = matchedRule.confidence;
      if (matchedRule.categoryId) {
        result.matchedCategoryId = matchedRule.categoryId;
      }
      if (matchedRule.preferredAccountId) {
        result.matchedAccountId = matchedRule.preferredAccountId;
      }
    }

    // Determine status thresholds
    const isEngineEnabled = settings.isEnabled;
    if (isEngineEnabled) {
      if (result.confidence >= settings.autoSaveThreshold && result.matchedCategoryId && result.matchedAccountId) {
        result.autoSave = true;
        result.preFill = true;
        result.needsReview = false;
      } else if (result.confidence >= settings.autoSuggestThreshold) {
        result.preFill = true;
        result.needsReview = true;
      } else if (result.confidence >= settings.reviewThreshold) {
        result.preFill = true;
        result.needsReview = true;
      } else {
        result.preFill = false;
        result.needsReview = true;
      }
    }

    return result;
  }

  async learnFromDecision(
    tempTx: any,
    decision: 'accepted' | 'edited' | 'rejected' | 'skipped',
    categoryId?: string,
    accountId?: string
  ): Promise<void> {
    const finalCategory = categoryId || tempTx.matchedCategoryId;
    const finalAccount = accountId || tempTx.matchedAccountId;

    // 1. Update/Create Bank Account Mapping Rule
    if (tempTx.bankName && tempTx.accountLast4 && finalAccount) {
      const existingAcctRule = await SmsRepository.findRuleByAccount(tempTx.bankName, tempTx.accountLast4);
      if (existingAcctRule) {
        // If user changed the account preference
        if (existingAcctRule.preferredAccountId !== finalAccount) {
          existingAcctRule.preferredAccountId = finalAccount;
          existingAcctRule.acceptedCount = 1;
          existingAcctRule.editedCount = 1;
          await SmsRepository.saveRule(existingAcctRule);
        } else {
          await SmsRepository.updateRuleStats(existingAcctRule.id, decision === 'accepted' ? 'accepted' : 'edited');
        }
      } else {
        // Create new account rule
        const newAcctRule = {
          id: `rule_acc_${uuid()}`,
          ruleType: 'ACCOUNT',
          bankName: tempTx.bankName,
          accountLast4: tempTx.accountLast4,
          preferredAccountId: finalAccount,
          acceptedCount: 1,
          confidence: 70, // Starter confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newAcctRule);
      }
    }

    // 2. Update/Create UPI ID Rule
    if (tempTx.upiId && (finalCategory || finalAccount)) {
      const existingUpiRule = await SmsRepository.findRuleByUpi(tempTx.upiId);
      if (existingUpiRule) {
        // If settings changed
        let statsUpdated = false;
        if (finalCategory && existingUpiRule.categoryId !== finalCategory) {
          existingUpiRule.categoryId = finalCategory;
          statsUpdated = true;
        }
        if (finalAccount && existingUpiRule.preferredAccountId !== finalAccount) {
          existingUpiRule.preferredAccountId = finalAccount;
          statsUpdated = true;
        }

        if (statsUpdated) {
          existingUpiRule.acceptedCount = 1;
          existingUpiRule.editedCount = existingUpiRule.editedCount + 1;
          await SmsRepository.saveRule(existingUpiRule);
          await SmsRepository.recalculateConfidence(existingUpiRule.id);
        } else {
          await SmsRepository.updateRuleStats(existingUpiRule.id, decision);
        }
      } else {
        const newUpiRule = {
          id: `rule_upi_${uuid()}`,
          ruleType: 'UPI',
          upiId: tempTx.upiId,
          categoryId: finalCategory,
          preferredAccountId: finalAccount,
          acceptedCount: 1,
          confidence: 60, // Initial confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newUpiRule);
      }
    }

    // 3. Update/Create Merchant Rule
    if (tempTx.merchant && (finalCategory || finalAccount)) {
      const existingMerchantRule = await SmsRepository.findRuleByMerchant(tempTx.merchant);
      if (existingMerchantRule) {
        let statsUpdated = false;
        if (finalCategory && existingMerchantRule.categoryId !== finalCategory) {
          existingMerchantRule.categoryId = finalCategory;
          statsUpdated = true;
        }
        if (finalAccount && existingMerchantRule.preferredAccountId !== finalAccount) {
          existingMerchantRule.preferredAccountId = finalAccount;
          statsUpdated = true;
        }

        if (statsUpdated) {
          existingMerchantRule.acceptedCount = 1;
          existingMerchantRule.editedCount = existingMerchantRule.editedCount + 1;
          await SmsRepository.saveRule(existingMerchantRule);
          await SmsRepository.recalculateConfidence(existingMerchantRule.id);
        } else {
          await SmsRepository.updateRuleStats(existingMerchantRule.id, decision);
        }
      } else {
        const newMerchantRule = {
          id: `rule_mer_${uuid()}`,
          ruleType: 'MERCHANT',
          merchantPattern: tempTx.merchant,
          categoryId: finalCategory,
          preferredAccountId: finalAccount,
          acceptedCount: 1,
          confidence: 60, // Initial confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newMerchantRule);
      }
    }
  }
}
