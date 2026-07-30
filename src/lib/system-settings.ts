import { prisma } from './prisma';

export interface CreditSettings {
  costSingleSided: number;
  costDoubleSided: number;
  costApprovalPdf: number;
  costApprovalPdfSingle: number;
  costApprovalPdfDouble: number;
  priceCreditBasic: number;
  priceCreditPro: number;
  priceCreditEnterprise: number;
}

export async function getCreditSettings(): Promise<CreditSettings> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'credit_cost_single_sided',
            'credit_cost_double_sided',
            'credit_cost_approval_pdf',
            'credit_cost_approval_pdf_single',
            'credit_cost_approval_pdf_double',
            'price_credit_basic',
            'price_credit_pro',
            'price_credit_enterprise'
          ]
        }
      }
    });

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const legacyApproval = settingsMap.get('credit_cost_approval_pdf') || '20';

    return {
      costSingleSided: Number(settingsMap.get('credit_cost_single_sided') || '10'),
      costDoubleSided: Number(settingsMap.get('credit_cost_double_sided') || '15'),
      costApprovalPdf: Number(legacyApproval),
      costApprovalPdfSingle: Number(settingsMap.get('credit_cost_approval_pdf_single') || '10'),
      costApprovalPdfDouble: Number(settingsMap.get('credit_cost_approval_pdf_double') || legacyApproval),
      priceCreditBasic: Number(settingsMap.get('price_credit_basic') || '1.5'),
      priceCreditPro: Number(settingsMap.get('price_credit_pro') || '1.2'),
      priceCreditEnterprise: Number(settingsMap.get('price_credit_enterprise') || '1.0'),
    };
  } catch (error) {
    console.error('Failed to fetch credit settings from database:', error);
    return {
      costSingleSided: 10,
      costDoubleSided: 15,
      costApprovalPdf: 20,
      costApprovalPdfSingle: 10,
      costApprovalPdfDouble: 20,
      priceCreditBasic: 1.5,
      priceCreditPro: 1.2,
      priceCreditEnterprise: 1.0,
    };
  }
}
