/**
 * Shared add-promotion flow for a club tier. Used by both settings and setup routes
 * so promotion-set logic (tierContext) is always applied when adding a 2nd+ promo.
 */
import type { AppSessionData } from '~/lib/session-storage.server';
import type { Discount } from '~/types';
import * as db from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm/index.server';

export type CreatePromotionForTierResult = {
  id: string;
  title: string;
};

/**
 * Create a promotion in the CRM for the given tier and persist to LV.
 * For Commerce7, when the tier will have 2+ promos, the provider creates the promotion set
 * and returns promotionSetId; we persist it on the tier.
 */
export async function createPromotionForTier(
  session: AppSessionData,
  tierId: string,
  discount: Discount
): Promise<CreatePromotionForTierResult> {
  const tier = await db.getClubStageWithDetails(tierId);
  if (!tier?.c7_club_id) {
    throw new Error('Tier not found or not synced to C7. Save tier details first.');
  }

  const existingPromos = await db.getStagePromotions(tierId);
  const tierContext = {
    tierName: tier.name,
    existingSetId: (tier as { c7_promo_set_id?: string | null }).c7_promo_set_id ?? undefined,
    existingPromoIds: existingPromos.map((p) => p.crm_id).filter((id): id is string => Boolean(id)),
  };

  const created = await crm.createPromotion(session, discount, tier.c7_club_id, tierContext);

  await db.createStagePromotions(tierId, [{
    crmId: created.id,
    crmType: session.crmType,
    title: created.title,
  }]);

  if (created.promotionSetId) {
    await db.updateClubStage(tierId, { c7PromoSetId: created.promotionSetId });
  }

  return { id: created.id, title: created.title };
}

/**
 * Delete all CRM resources for a tier (promotions and promotion set).
 * Used by both settings and setup tier-delete flows so CRM-specific logic stays in one place.
 * - Deletes each promotion in the CRM; throws on failure so the route can return an error.
 * - If Commerce7 and tier has a promotion set, deletes the set (logs warning on failure, does not throw).
 */
export async function deleteTierCrmResources(
  session: AppSessionData,
  tierId: string
): Promise<void> {
  const tier = await db.getClubStageWithDetails(tierId);
  const promotions = await db.getStagePromotions(tierId);

  for (const promo of promotions) {
    if (promo.crm_type === session.crmType && promo.crm_id) {
      await crm.deletePromotion(session, promo.crm_id);
    }
  }

  if (session.crmType === 'commerce7' && tier) {
    const setId = (tier as { c7_promo_set_id?: string | null }).c7_promo_set_id;
    if (setId) {
      try {
        await crm.deletePromotionSet(session, setId);
      } catch (err) {
        console.warn('Failed to delete C7 promotion set (tier delete):', setId, err);
      }
    }
  }
}
