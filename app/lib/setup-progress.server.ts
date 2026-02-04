import { getClubProgram, getCommunicationConfig, getStagePromotions } from '~/lib/db/supabase.server';

export interface SetupProgressData {
  hasClubProgram: boolean;
  hasTier: boolean;
  hasPromo: boolean;
  hasCommConfig: boolean;
  progress: number;
}

export async function calculateSetupProgress(clientId: string): Promise<SetupProgressData> {
  const clubProgram = await getClubProgram(clientId);
  const commConfig = await getCommunicationConfig(clientId);
  
  let progress = 0;
  let hasClubProgram = false;
  let hasTier = false;
  let hasPromo = false;
  let hasCommConfig = false;
  
  // Club program exists: 25%
  if (clubProgram) {
    hasClubProgram = true;
    progress += 25;
    
    // At least one tier exists: 25%
    const savedTiers = (clubProgram.club_stages || []).filter((tier: any) => {
      // Filter out unsaved tiers (those with default "New Tier X" names)
      return tier.name && !tier.name.match(/^New Tier \d+$/);
    });
    
    if (savedTiers.length > 0) {
      hasTier = true;
      progress += 25;
      
      // At least one promotion exists: 25%
      for (const tier of savedTiers) {
        const promotions = await getStagePromotions(tier.id);
        if (promotions.length > 0) {
          hasPromo = true;
          progress += 25;
          break;
        }
      }
    }
  }
  
  // Communication config exists with email_provider: 25%
  if (commConfig && commConfig.email_provider) {
    hasCommConfig = true;
    progress += 25;
  }
  
  return {
    hasClubProgram,
    hasTier,
    hasPromo,
    hasCommConfig,
    progress,
  };
}
