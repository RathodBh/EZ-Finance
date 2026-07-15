export interface ParsedSms {
  bankName: string | null;
  accountLast4: string | null;
  merchant: string | null;
  merchantRaw: string | null;
  upiId: string | null;
  amount: number | null;
  transactionType: 'DEBIT' | 'CREDIT' | null;
  paymentMode: 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'ATM' | 'CARD' | 'NET_BANKING' | null;
  transactionDate: number | null; // epoch ms
  balance: string | null;
  referenceNo: string | null;
  rawBody: string;
}

export interface ISmsParser {
  canParse(smsBody: string, sender: string): boolean;
  parse(smsBody: string, sender: string, timestamp: number): ParsedSms;
}
