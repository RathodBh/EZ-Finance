import { ISmsParser, ParsedSms } from './ISmsParser';

export class BankSmsParser implements ISmsParser {
  // Sender prefix mappings
  private bankPrefixes: Record<string, string> = {
    'hdfc': 'HDFC Bank',
    'sbi': 'State Bank of India',
    'icici': 'ICICI Bank',
    'axis': 'Axis Bank',
    'kotak': 'Kotak Mahindra Bank',
    'pnb': 'Punjab National Bank',
    'canara': 'Canara Bank',
    'idfc': 'IDFC First Bank',
    'bob': 'Bank of Baroda',
    'aubank': 'AU Small Finance Bank',
    'yesbk': 'Yes Bank',
    'federal': 'Federal Bank',
  };

  canParse(smsBody: string, sender: string): boolean {
    const s = sender.toLowerCase();
    const body = smsBody.toLowerCase();
    
    // Check if sender belongs to a known financial institution
    const isKnownSender = Object.keys(this.bankPrefixes).some(prefix => s.includes(prefix));
    
    // Or if the message contains strong banking keywords (Rs, A/c, credited, debited)
    const hasBankingKeywords = 
      (body.includes('rs.') || body.includes('inr') || body.includes('₹')) && 
      (body.includes('debited') || body.includes('credited') || body.includes('spent') || body.includes('withdrawn') || body.includes('received'));

    return isKnownSender || hasBankingKeywords;
  }

  parse(smsBody: string, sender: string, timestamp: number): ParsedSms {
    const cleanBody = smsBody.replace(/\s+/g, ' ');
    const lowerBody = cleanBody.toLowerCase();
    const senderLower = sender.toLowerCase();

    // 1. Identify Bank Name
    let bankName: string | null = null;
    for (const [prefix, name] of Object.entries(this.bankPrefixes)) {
      if (senderLower.includes(prefix)) {
        bankName = name;
        break;
      }
    }
    if (!bankName) {
      if (lowerBody.includes('hdfc')) bankName = 'HDFC Bank';
      else if (lowerBody.includes('sbi') || lowerBody.includes('state bank')) bankName = 'State Bank of India';
      else if (lowerBody.includes('icici')) bankName = 'ICICI Bank';
      else if (lowerBody.includes('axis')) bankName = 'Axis Bank';
      else if (lowerBody.includes('kotak')) bankName = 'Kotak Mahindra Bank';
      else bankName = 'Other Bank';
    }

    // 2. Extract Amount
    let amount: number | null = null;
    const amountRegexes = [
      /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /spent\s+(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /credited\s+(?:with\s+)?(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    ];
    for (const regex of amountRegexes) {
      const match = cleanBody.match(regex);
      if (match && match[1]) {
        // Remove commas and parse
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) {
          amount = val;
          break;
        }
      }
    }

    // 3. Detect Debit / Credit
    let transactionType: 'DEBIT' | 'CREDIT' | null = null;
    const debitKeywords = ['debited', 'deducted', 'spent', 'paid', 'withdrawn', 'declined', 'sent', 'transfer to'];
    const creditKeywords = ['credited', 'received', 'added', 'deposited', 'refunded'];

    const firstDebitIndex = Math.min(...debitKeywords.map(k => {
      const idx = lowerBody.indexOf(k);
      return idx === -1 ? Infinity : idx;
    }));
    const firstCreditIndex = Math.min(...creditKeywords.map(k => {
      const idx = lowerBody.indexOf(k);
      return idx === -1 ? Infinity : idx;
    }));

    if (firstDebitIndex !== Infinity || firstCreditIndex !== Infinity) {
      transactionType = firstDebitIndex < firstCreditIndex ? 'DEBIT' : 'CREDIT';
    } else {
      // Fallback simple checks
      if (debitKeywords.some(k => lowerBody.includes(k))) {
        transactionType = 'DEBIT';
      } else if (creditKeywords.some(k => lowerBody.includes(k))) {
        transactionType = 'CREDIT';
      }
    }

    // 4. Extract Account Last 4
    let accountLast4: string | null = null;
    const acctRegexes = [
      /a\/c\s*(?:no\.?)?\s*[*xX]*(\d{4})/i,
      /account\s*(?:no\.?)?\s*[*xX]*(\d{4})/i,
      /card\s*(?:no\.?)?\s*[*xX]*(\d{4})/i,
      /ending\s+in\s+(\d{4})/i,
      /[*xX]+(\d{4})/i,
    ];
    for (const regex of acctRegexes) {
      const match = cleanBody.match(regex);
      if (match && match[1]) {
        accountLast4 = match[1];
        break;
      }
    }

    // 5. Extract UPI ID (if present)
    let upiId: string | null = null;
    const upiRegex = /([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/i;
    const upiMatch = cleanBody.match(upiRegex);
    if (upiMatch && upiMatch[1]) {
      upiId = upiMatch[1].toLowerCase();
    }

    // 6. Payment Mode detection
    let paymentMode: ParsedSms['paymentMode'] = null;
    if (lowerBody.includes('upi') || lowerBody.includes('gpay') || lowerBody.includes('phonepe') || upiId) {
      paymentMode = 'UPI';
    } else if (lowerBody.includes('atm') || lowerBody.includes('cash withdrawal')) {
      paymentMode = 'ATM';
    } else if (lowerBody.includes('card') || lowerBody.includes('spent on') || lowerBody.includes('pos')) {
      paymentMode = 'CARD';
    } else if (lowerBody.includes('imps')) {
      paymentMode = 'IMPS';
    } else if (lowerBody.includes('neft')) {
      paymentMode = 'NEFT';
    } else if (lowerBody.includes('rtgs')) {
      paymentMode = 'RTGS';
    } else if (lowerBody.includes('net banking') || lowerBody.includes('netbanking') || lowerBody.includes('internet banking')) {
      paymentMode = 'NET_BANKING';
    }

    // 7. Extract Merchant / Payee
    let merchant: string | null = null;
    let merchantRaw: string | null = null;

    // Regex list to find merchant in common patterns
    const merchantRegexes = [
      /at\s+([A-Za-z0-9\s.\-*]+?)(?:\s+on|\s+via|\s+using|\s+ref|\s+info|\.|$)/i,
      /to\s+([A-Za-z0-9\s.\-*]+?)(?:\s+on|\s+via|\s+using|\s+ref|\s+info|\.|$)/i,
      /info\*\s*([A-Za-z0-9\s.\-*]+?)(?:\s+on|\.|$)/i,
      /paid\s+to\s+([A-Za-z0-9\s.\-*]+?)(?:\s+on|\.|$)/i,
      /transfer\s+to\s+([A-Za-z0-9\s.\-*]+?)(?:\s+on|\.|$)/i,
    ];

    for (const regex of merchantRegexes) {
      const match = cleanBody.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        // Ignore generic words
        const isGeneric = ['your', 'a/c', 'account', 'card', 'bank', 'atm', 'user'].includes(val.toLowerCase());
        if (val.length > 1 && !isGeneric) {
          merchantRaw = val;
          // Clean merchant name
          merchant = this.cleanMerchantName(val);
          break;
        }
      }
    }

    // If still no merchant and we have a UPI ID, let's use the UPI ID handle prefix
    if (!merchant && upiId) {
      merchantRaw = upiId;
      const prefix = upiId.split('@')[0];
      // remove punctuation/dots
      merchant = this.cleanMerchantName(prefix.replace(/[.\-_]/g, ' '));
    }

    // 8. Balance / Reference No
    let balance: string | null = null;
    const balanceMatch = cleanBody.match(/(?:bal|balance|avl bal|available balance)\s*(?:is|has\s+been)?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (balanceMatch && balanceMatch[1]) {
      balance = balanceMatch[1];
    }

    let referenceNo: string | null = null;
    const refMatch = cleanBody.match(/(?:ref|txn|reference|utr)\s*(?:no\.?)?\s*(?:is\s*)?([A-Za-z0-9]+)/i);
    if (refMatch && refMatch[1]) {
      referenceNo = refMatch[1];
    }

    return {
      bankName,
      accountLast4,
      merchant,
      merchantRaw,
      upiId,
      amount,
      transactionType,
      paymentMode,
      transactionDate: timestamp,
      balance,
      referenceNo,
      rawBody: smsBody,
    };
  }

  private cleanMerchantName(raw: string): string {
    let name = raw;
    
    // 1. Remove excess star symbols or reference strings
    name = name.replace(/[*xX]+/g, ' ');
    
    // 2. Remove common transaction words
    name = name.replace(/\b(?:ltd|pvt|co|limited|gpay|paytm|phonepe|upi|vpa)\b/gi, '');
    
    // 3. Remove numerical IDs (e.g. UPI txn ref numbers appended to merchant name)
    name = name.replace(/\b\d{6,}\b/g, '');

    // 4. Remove single characters
    name = name.split(/\s+/).filter(word => word.length > 1 || /^[a-zA-Z0-9]$/.test(word)).join(' ');

    // 5. Trim and clean duplicate spacing
    name = name.trim().replace(/\s+/g, ' ');

    // 6. Title Case
    if (name.length > 0) {
      name = name.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }

    return name || raw;
  }
}
