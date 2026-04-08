import { supabase } from '../lib/supabase';

export interface UserProfile {
  name: string;
  persona_id: string;
  writing_style: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  age: number;
  persona_id: string;
  custom_persona_id: string | null;
  writing_style: string | null;
  is_default: boolean;
  top_size: string | null;
  bottom_size: string | null;
  shoe_size: string | null;
  default_avatar_id: string | null;
  default_location_id: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  enable_planner_notifications: boolean;
  notification_days_before: number;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<Omit<NotificationPreferences, 'user_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...preferences });

  if (error) throw error;
}

export async function createFamilyMember(
  userId: string,
  member: Omit<FamilyMember, 'id'>
): Promise<FamilyMember> {
  const { data, error } = await supabase
    .from('family_members')
    .insert({ user_id: userId, ...member })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFamilyMember(
  memberId: string,
  member: Partial<Omit<FamilyMember, 'id'>>
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update(member)
    .eq('id', memberId);

  if (error) throw error;
}

export async function deleteFamilyMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

export async function getDefaultAvatarPhoto(userId: string): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('default_avatar_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile?.default_avatar_id) return null;

  const { data: avatar, error: avatarError } = await supabase
    .from('avatars')
    .select('photo_base64')
    .eq('id', profile.default_avatar_id)
    .maybeSingle();

  if (avatarError || !avatar?.photo_base64) return null;
  return avatar.photo_base64;
}

export async function getDefaultLocationPhoto(userId: string): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('default_location_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile?.default_location_id) return null;

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('photo_base64')
    .eq('id', profile.default_location_id)
    .maybeSingle();

  if (locationError || !location?.photo_base64) return null;
  return location.photo_base64;
}

export interface AvatarData {
  id: string;
  name: string;
  gender: string | null;
  age_group: string | null;
  origin: string | null;
  skin_tone: string | null;
  hair_color: string | null;
  hair_cut: string | null;
  hair_texture: string | null;
  eye_color: string | null;
  build: string | null;
  additional_features: string | null;
  render_style: string | null;
  generation_prompt: string | null;
  photo_base64: string | null;
  photo_url: string | null;
  reference_photo_url: string | null;
}

export interface LocationData {
  id: string;
  name: string;
  description: string | null;
  photo_base64: string | null;
  photo_url: string | null;
  generation_prompt: string | null;
  reference_photo_url: string | null;
}

export async function getDefaultSellerAvatarAndLocation(userId: string): Promise<{
  avatarPhoto: string | null;
  locationPhoto: string | null;
  writingStyle: string | null;
  personaId: string | null;
}> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id, default_avatar_id, default_location_id, persona_id, writing_style')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { avatarPhoto: null, locationPhoto: null, writingStyle: null, personaId: null };
  }

  let avatarId = profile.default_avatar_id;
  let locationId = profile.default_location_id;
  let writingStyle = profile.writing_style;
  let personaId = profile.persona_id;

  if (profile.default_seller_id) {
    const { data: member } = await supabase
      .from('family_members')
      .select('default_avatar_id, default_location_id, writing_style, persona_id')
      .eq('id', profile.default_seller_id)
      .maybeSingle();

    if (member) {
      avatarId = member.default_avatar_id || avatarId;
      locationId = member.default_location_id || locationId;
      writingStyle = member.writing_style || writingStyle;
      personaId = member.persona_id || personaId;
    }
  }

  let avatarPhoto: string | null = null;
  let locationPhoto: string | null = null;

  if (avatarId) {
    const { data: avatar } = await supabase
      .from('avatars')
      .select('photo_base64')
      .eq('id', avatarId)
      .maybeSingle();

    avatarPhoto = avatar?.photo_base64 || null;
  }

  if (locationId) {
    const { data: location } = await supabase
      .from('locations')
      .select('photo_base64')
      .eq('id', locationId)
      .maybeSingle();

    locationPhoto = location?.photo_base64 || null;
  }

  return { avatarPhoto, locationPhoto, writingStyle, personaId };
}

export async function getDefaultAvatarAndLocationDetails(userId: string): Promise<{
  avatar: AvatarData | null;
  location: LocationData | null;
  writingStyle: string | null;
  personaId: string | null;
}> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id, default_avatar_id, default_location_id, persona_id, writing_style')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { avatar: null, location: null, writingStyle: null, personaId: null };
  }

  let avatarId = profile.default_avatar_id;
  let locationId = profile.default_location_id;
  let writingStyle = profile.writing_style;
  let personaId = profile.persona_id;

  if (profile.default_seller_id) {
    const { data: member } = await supabase
      .from('family_members')
      .select('default_avatar_id, default_location_id, writing_style, persona_id')
      .eq('id', profile.default_seller_id)
      .maybeSingle();

    if (member) {
      avatarId = member.default_avatar_id || avatarId;
      locationId = member.default_location_id || locationId;
      writingStyle = member.writing_style || writingStyle;
      personaId = member.persona_id || personaId;
    }
  }

  let avatar: AvatarData | null = null;
  let location: LocationData | null = null;

  if (avatarId) {
    const { data: avatarData } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .maybeSingle();

    if (avatarData) {
      avatar = avatarData as AvatarData;
    }
  }

  if (locationId) {
    const { data: locationData } = await supabase
      .from('locations')
      .select('id, name, description, photo_base64, photo_url, generation_prompt, reference_photo_url')
      .eq('id', locationId)
      .maybeSingle();

    if (locationData) {
      location = locationData as LocationData;
    }
  }

  return { avatar, location, writingStyle, personaId };
}

export async function getUserLocations(userId: string): Promise<LocationData[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id')
    .eq('id', userId)
    .maybeSingle();

  const familyMemberId = profile?.default_seller_id;

  let query = supabase
    .from('locations')
    .select('id, name, description, photo_base64, photo_url, generation_prompt, reference_photo_url')
    .eq('user_id', userId);

  if (familyMemberId) {
    query = query.or(`family_member_id.eq.${familyMemberId},family_member_id.is.null`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getUserAvatars(userId: string): Promise<AvatarData[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id')
    .eq('id', userId)
    .maybeSingle();

  const familyMemberId = profile?.default_seller_id;

  let query = supabase
    .from('avatars')
    .select('*')
    .eq('user_id', userId);

  if (familyMemberId) {
    query = query.or(`family_member_id.eq.${familyMemberId},family_member_id.is.null`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
