// Card image lifecycle for Gemini-generated fallbacks. Mirrors
// src/lib/trip-cover.ts. Only runs when a card has no image_url — i.e.
// Google Places returned nothing (abstract activities, fuzzy queries,
// or an invalid key). Real Places photos are preserved as-is.

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateCardImage, type CardImageInput } from '@/lib/gemini'

export type CardImageCard = {
  id: string
  title: string
  description: string | null
  category: 'restaurant' | 'activity' | 'sightseeing'
  image_url: string | null
}

export type GenerateAndStoreCardImageResult =
  | { ok: true; image_url: string; cached: boolean }
  | { ok: false; error: string }

export async function generateAndStoreCardImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  card: CardImageCard,
  destination: string
): Promise<GenerateAndStoreCardImageResult> {
  // Idempotent: Places photos and prior Gemini uploads both short-circuit.
  if (card.image_url) {
    return { ok: true, image_url: card.image_url, cached: true }
  }

  const input: CardImageInput = {
    title: card.title,
    description: card.description,
    category: card.category,
    destination,
  }

  let image
  try {
    image = await generateCardImage(input)
  } catch (err) {
    return {
      ok: false,
      error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  if (!image) {
    return { ok: false, error: 'No image returned by Gemini (content filter?)' }
  }

  const path = `${card.id}.png`
  const { error: uploadError } = await supabase.storage
    .from('card-images')
    .upload(path, image.data, {
      contentType: image.mimeType,
      upsert: true,
    })
  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` }
  }

  const { data: publicUrlData } = supabase.storage.from('card-images').getPublicUrl(path)
  const imageUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', card.id)
  if (updateError) {
    return { ok: false, error: `DB update failed: ${updateError.message}` }
  }

  return { ok: true, image_url: imageUrl, cached: false }
}
