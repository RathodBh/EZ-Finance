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
    let acctRule: any = null;
    if (parsed.bankName && parsed.accountLast4) {
      acctRule = await SmsRepository.findRuleByAccount(parsed.bankName, parsed.accountLast4);
      if (acctRule && acctRule.isEnabled) {
        if (acctRule.preferredAccountId) {
          result.matchedAccountId = acctRule.preferredAccountId;
        }
        if (acctRule.isTransfer) {
          result.isTransfer = true;
          result.matchedToAccountId = acctRule.targetAccountId || null;
        }
        if (acctRule.categoryId) {
          result.matchedCategoryId = acctRule.categoryId;
        }
        result.matchedRuleId = acctRule.id;
        result.confidence = acctRule.confidence || 0;
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

    // 3. MATCH BY MERCHANT (or merchantRaw)
    if (!matchedRule && (parsed.merchant || parsed.merchantRaw)) {
      const merchantTerm = parsed.merchant || parsed.merchantRaw!;
      const merchantRule = await SmsRepository.findRuleByMerchant(merchantTerm);
      if (merchantRule && merchantRule.isEnabled) {
        matchedRule = merchantRule;
      }
    }

    // Apply rule category & account choices
    if (matchedRule) {
      result.matchedRuleId = matchedRule.id;
      // If we also had an account rule, take the higher confidence
      if (acctRule && (acctRule.confidence || 0) > 0) {
        result.confidence = Math.max(matchedRule.confidence || 0, acctRule.confidence || 0);
      } else {
        result.confidence = matchedRule.confidence || 0;
      }

      if (matchedRule.categoryId) {
        result.matchedCategoryId = matchedRule.categoryId;
      }
      if (matchedRule.preferredAccountId) {
        result.matchedAccountId = matchedRule.preferredAccountId;
      }
      if (matchedRule.isTransfer) {
        result.isTransfer = true;
        result.matchedToAccountId = matchedRule.targetAccountId || null;
      }
    }

    // Determine status thresholds
    const isEngineEnabled = settings.isEnabled;
    if (isEngineEnabled) {
      if (result.confidence >= settings.autoSaveThreshold && (result.matchedCategoryId || result.isTransfer) && result.matchedAccountId) {
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
    accountId?: string,
    isTransfer?: boolean,
    toAccountId?: string
  ): Promise<void> {
    const finalCategory = categoryId || tempTx.matchedCategoryId;
    const finalAccount = accountId || tempTx.matchedAccountId;
    const finalIsTransfer = isTransfer ?? tempTx.isTransfer ?? false;
    const finalToAccount = toAccountId || tempTx.toAccountId;

    // 1. Update/Create Bank Account Mapping Rule
    if (tempTx.bankName && tempTx.accountLast4 && finalAccount) {
      const existingAcctRule = await SmsRepository.findRuleByAccount(tempTx.bankName, tempTx.accountLast4);
      if (existingAcctRule) {
        let changed = false;
        if (existingAcctRule.preferredAccountId !== finalAccount) {
          existingAcctRule.preferredAccountId = finalAccount;
          changed = true;
        }
        if (existingAcctRule.isTransfer !== finalIsTransfer) {
          existingAcctRule.isTransfer = finalIsTransfer;
          changed = true;
        }
        if (existingAcctRule.targetAccountId !== finalToAccount) {
          existingAcctRule.targetAccountId = finalToAccount;
          changed = true;
        }
        if (finalCategory && existingAcctRule.categoryId !== finalCategory) {
          existingAcctRule.categoryId = finalCategory;
          changed = true;
        }

        if (changed) {
          existingAcctRule.acceptedCount = 1;
          existingAcctRule.editedCount = (existingAcctRule.editedCount || 0) + 1;
          await SmsRepository.saveRule(existingAcctRule);
          await SmsRepository.recalculateConfidence(existingAcctRule.id);
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
          categoryId: finalCategory || null,
          isTransfer: finalIsTransfer,
          targetAccountId: finalToAccount || null,
          acceptedCount: 1,
          confidence: 70, // Starter confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newAcctRule);
      }
    }

    // 2. Update/Create UPI ID Rule
    if (tempTx.upiId && (finalCategory || finalAccount || finalIsTransfer)) {
      const existingUpiRule = await SmsRepository.findRuleByUpi(tempTx.upiId);
      if (existingUpiRule) {
        let statsUpdated = false;
        if (finalCategory && existingUpiRule.categoryId !== finalCategory) {
          existingUpiRule.categoryId = finalCategory;
          statsUpdated = true;
        }
        if (finalAccount && existingUpiRule.preferredAccountId !== finalAccount) {
          existingUpiRule.preferredAccountId = finalAccount;
          statsUpdated = true;
        }
        if (existingUpiRule.isTransfer !== finalIsTransfer || existingUpiRule.targetAccountId !== finalToAccount) {
          existingUpiRule.isTransfer = finalIsTransfer;
          existingUpiRule.targetAccountId = finalToAccount;
          statsUpdated = true;
        }

        if (statsUpdated) {
          existingUpiRule.acceptedCount = 1;
          existingUpiRule.editedCount = (existingUpiRule.editedCount || 0) + 1;
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
          categoryId: finalCategory || null,
          preferredAccountId: finalAccount || null,
          isTransfer: finalIsTransfer,
          targetAccountId: finalToAccount || null,
          acceptedCount: 1,
          confidence: 60, // Initial confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newUpiRule);
      }
    }

    // 3. Update/Create Merchant Rule
    const merchantKey = tempTx.merchant || tempTx.merchantRaw;
    if (merchantKey && (finalCategory || finalAccount || finalIsTransfer)) {
      const existingMerchantRule = await SmsRepository.findRuleByMerchant(merchantKey);
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
        if (existingMerchantRule.isTransfer !== finalIsTransfer || existingMerchantRule.targetAccountId !== finalToAccount) {
          existingMerchantRule.isTransfer = finalIsTransfer;
          existingMerchantRule.targetAccountId = finalToAccount;
          statsUpdated = true;
        }

        if (statsUpdated) {
          existingMerchantRule.acceptedCount = 1;
          existingMerchantRule.editedCount = (existingMerchantRule.editedCount || 0) + 1;
          await SmsRepository.saveRule(existingMerchantRule);
          await SmsRepository.recalculateConfidence(existingMerchantRule.id);
        } else {
          await SmsRepository.updateRuleStats(existingMerchantRule.id, decision);
        }
      } else {
        const newMerchantRule = {
          id: `rule_mer_${uuid()}`,
          ruleType: 'MERCHANT',
          merchantPattern: merchantKey,
          categoryId: finalCategory || null,
          preferredAccountId: finalAccount || null,
          isTransfer: finalIsTransfer,
          targetAccountId: finalToAccount || null,
          acceptedCount: 1,
          confidence: 60, // Initial confidence
          isEnabled: true,
        };
        await SmsRepository.saveRule(newMerchantRule);
      }
    }
  }
}
