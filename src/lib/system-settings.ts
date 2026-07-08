import { prisma } from './prisma';

export interface CreditSettings {
  costSingleSided: number;
  costDoubleSided: number;
  costApprovalPdf: number;
}

export async function getCreditSettings(): Promise<CreditSettings> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'credit_cost_single_sided',
            'credit_cost_double_sided',
            'credit_cost_approval_pdf'
          ]
        }
      }
    });

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    return {
      costSingleSided: Number(settingsMap.get('credit_cost_single_sided') || '10'),
      costDoubleSided: Number(settingsMap.get('credit_cost_double_sided') || '15'),
      costApprovalPdf: Number(settingsMap.get('credit_cost_approval_pdf') || '20'),
    };
  } catch (error) {
    console.error('Failed to fetch credit settings from database:', error);
    return {
      costSingleSided: 10,
      costDoubleSided: 15,
      costApprovalPdf: 20,
    };
  }
}
