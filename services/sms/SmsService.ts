import { BankSmsParser } from './BankSmsParser';
import { RuleEngine } from './RuleEngine';
import { SmsRepository, TransactionRepository } from '../../db/repositories';
import { uuid } from '../utils';

export class SmsService {
  private parser = new BankSmsParser();
  private ruleEngine = new RuleEngine();

  /**
   * Main entry point to process a batch of SMS messages (e.g. from inbox scan or paste)
   */
  async processSmsInbox(
    smsList: Array<{ id: string; body: string; address: string; date: number }>
  ): Promise<{ processed: number; duplicates: number; autoSaved: number }> {
    let processed = 0;
    let duplicates = 0;
    let autoSavedCount = 0;

    const settings = await SmsRepository.getSettings();
    if (!settings.isEnabled) {
      return { processed, duplicates, autoSaved: 0 };
    }

    for (const sms of smsList) {
      if (!this.parser.canParse(sms.body, sms.address)) {
        continue;
      }

      const parsed = this.parser.parse(sms.body, sms.address, sms.date);
      if (!parsed.amount || !parsed.transactionType) {
        continue;
      }

      // Generate unique hash to prevent duplicates
      const hash = this.generateHash(
        parsed.amount,
        parsed.merchant || parsed.merchantRaw || '',
        parsed.transactionDate || sms.date,
        parsed.accountLast4 || ''
      );

      const exists = await SmsRepository.hashExists(hash);
      if (exists) {
        duplicates++;
        continue;
      }

      // Match rules
      const ruleMatch = await this.ruleEngine.applyRules(parsed);

      const tempTxId = `temp_tx_${uuid()}`;
      const tempTx = {
        id: tempTxId,
        smsId: sms.id,
        smsHash: hash,
        smsBody: sms.body,
        bankName: parsed.bankName,
        accountLast4: parsed.accountLast4,
        merchant: parsed.merchant,
        merchantRaw: parsed.merchantRaw,
        upiId: parsed.upiId,
        amount: parsed.amount,
        transactionType: parsed.transactionType,
        paymentMode: parsed.paymentMode,
        transactionDate: parsed.transactionDate || sms.date,
        status: ruleMatch.autoSave ? 'AUTO_SAVED' : 'PENDING',
        confidence: ruleMatch.confidence,
        matchedAccountId: ruleMatch.matchedAccountId,
        matchedCategoryId: ruleMatch.matchedCategoryId,
        matchedRuleId: ruleMatch.matchedRuleId,
        isTransfer: ruleMatch.isTransfer || false,
        toAccountId: ruleMatch.matchedToAccountId || null,
        processed: ruleMatch.autoSave,
      };

      // Save temp transaction
      await SmsRepository.saveTempTransaction(tempTx);

      // Promote instantly if auto-save criteria is met
      if (ruleMatch.autoSave && ruleMatch.matchedAccountId && (ruleMatch.matchedCategoryId || ruleMatch.isTransfer)) {
        await this.promoteToRealTransaction(
          tempTx,
          ruleMatch.matchedCategoryId || 'transfer_cat_id',
          ruleMatch.matchedAccountId,
          ruleMatch.isTransfer,
          ruleMatch.matchedToAccountId || undefined
        );
        
        // Update stats
        if (ruleMatch.matchedRuleId) {
          await SmsRepository.updateRuleStats(ruleMatch.matchedRuleId, 'auto_saved');
        }
        autoSavedCount++;
      }

      processed++;
    }

    // Keep track of the latest processed SMS id
    if (smsList.length > 0) {
      const sorted = [...smsList].sort((a, b) => b.date - a.date);
      await SmsRepository.updateSettings({ lastProcessedSmsId: sorted[0].id });
    }

    return { processed, duplicates, autoSaved: autoSavedCount };
  }

  /**
   * Promotes a temp transaction into a real financial transaction in the main db
   */
  async promoteToRealTransaction(
    tempTx: any, 
    categoryId: string, 
    accountId: string, 
    isTransfer?: boolean, 
    toAccountId?: string
  ): Promise<any> {
    const isTxTransfer = isTransfer ?? tempTx.isTransfer ?? (tempTx.transactionType === 'TRANSFER');
    const finalToAccountId = toAccountId || tempTx.toAccountId;

    const txData = {
      id: `tx_${uuid()}`,
      amount: tempTx.amount,
      date: tempTx.transactionDate,
      description: tempTx.merchant ? `SMS: ${tempTx.merchant}` : tempTx.smsBody.substring(0, 50),
      type: isTxTransfer ? 'TRANSFER' : tempTx.transactionType, // DEBIT | CREDIT | TRANSFER
      accountId: accountId,
      toAccountId: isTxTransfer ? finalToAccountId : null,
      categoryId: isTxTransfer ? (categoryId || 'transfer_cat_id') : categoryId,
      merchant: tempTx.merchant || '',
      paymentMethod: isTxTransfer ? 'TRANSFER' : (tempTx.paymentMode || 'CARD'),
      isRecurring: false,
      isFavorite: false,
    };

    return await TransactionRepository.insert(txData);
  }

  /**
   * Helper to generate a fingerprint hash
   */
  generateHash(amount: number, merchant: string, date: number, last4: string): string {
    const sanitizedMerchant = merchant.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateBucket = Math.round(date / 1000); // 1-second precision bucket
    return `sms_hash_${amount}_${sanitizedMerchant}_${dateBucket}_${last4}`;
  }

  /**
   * Seeds mock data for quick testing and demonstration
   */
  getMockSmsList(): Array<{ id: string; body: string; address: string; date: number }> {
    const now = Date.now();
    return [
      {
        id: 'mock_1',
        body: 'Alert: Your HDFC Bank Debit Card ending in 4321 was spent at Swiggy for Rs. 350.00 on 15-07-2026. Avl Bal: Rs. 45,200.',
        address: 'HDFCBK',
        date: now - 3600000 * 3, // 3 hours ago
      },
      {
        id: 'mock_2',
        body: 'SBI SMS: Dear Customer, your A/c ending 1234 has been debited by Rs 1,299.00 on 15-07-26 via UPI to Amazon@okhdfc. Ref 601293810.',
        address: 'SBIINB',
        date: now - 3600000 * 5, // 5 hours ago
      },
      {
        id: 'mock_3',
        body: 'Transaction Alert: INR 450.00 credited to ICICI Bank A/c xx8899 on 15/07/26 from friend@okaxis. Enjoy banking!',
        address: 'ICICIB',
        date: now - 3600000 * 24, // 1 day ago
      },
      {
        id: 'mock_4',
        body: 'Kotak Bank Info: Rs. 150.00 spent at Star Starbucks via UPI. Ref No: 1092837192. Avl Balance: Rs. 18,290.00.',
        address: 'KOTAKB',
        date: now - 3600000 * 26, // 1 day ago
      },
      {
        id: 'mock_5',
        body: 'HDFC Bank: Rs. 5,000.00 withdrawn from ATM using card xx4321 on 14-07-2026. Avl Bal: Rs. 40,200.',
        address: 'HDFCBK',
        date: now - 3600000 * 48, // 2 days ago
      },
      {
        id: 'mock_6',
        body: 'HDFC Bank: Rs 5,000.00 debited for Transfer to ICICI Bank A/c xx8899 on 16-07-2026. Ref UPI/Self-Transfer.',
        address: 'HDFCBK',
        date: now - 1800000, // 30 mins ago
      },
    ];
  }
}
export const smsServiceInstance = new SmsService();

// Register window.simulateSMS helper for Browser Console testing on Web
if (typeof window !== 'undefined') {
  (window as any).simulateSMS = async (smsBody: string, address: string = 'HDFCBK') => {
    console.log('🧪 [SMS Dev Simulator] Processing custom SMS:', smsBody);
    const mockItem = {
      id: `custom_web_${Date.now()}`,
      body: smsBody,
      address,
      date: Date.now(),
    };
    const res = await smsServiceInstance.processSmsInbox([mockItem]);
    console.log('✅ [SMS Dev Simulator] Result:', res);
    const { useAppStore } = require('../../store/appStore');
    await useAppStore.getState().refreshSmsData();
    return res;
  };
}

