
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { AvatarProfile, LocationProfile, Preset, StylistPhoto } from '../types';
import { compressAvatarImage, compressLocationImage, compressStylistPhoto } from './imageCompression';

const getEnv = (key: string) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== "" && supabaseAnonKey !== "")
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// --- INDEXEDDB UTILITIES ---
const DB_NAME = 'VogueAI_Studio';
const DB_VERSION = 2; // Incremented version for new store
const STORE_AVATARS = 'avatars';
const STORE_LOCATIONS = 'locations';
const STORE_PRESETS = 'presets';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_AVATARS)) db.createObjectStore(STORE_AVATARS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_LOCATIONS)) db.createObjectStore(STORE_LOCATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_PRESETS)) db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    request.onerror = () => reject(request.error);
  });
};

const idbSave = async <T>(storeName: string, data: T): Promise<T> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
};

const idbDelete = async (storeName: string, id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
};

// Export auth helpers
export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
};

export const isUserAuthenticated = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  return userId !== null;
};

// --- STORAGE HELPERS ---
const base64ToBlob = (base64: string): Blob => {
  const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const mimeType = base64.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

const uploadImageToStorage = async (
  base64Image: string,
  folder: 'avatars' | 'locations' | 'photos',
  fileName: string
): Promise<string> => {
  if (!supabase) throw new Error('Supabase not initialized');

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User must be authenticated');

  let compressedImage = base64Image;
  if (folder === 'avatars') {
    compressedImage = await compressAvatarImage(base64Image);
  } else if (folder === 'locations') {
    compressedImage = await compressLocationImage(base64Image);
  } else if (folder === 'photos') {
    compressedImage = await compressStylistPhoto(base64Image);
  }

  const blob = base64ToBlob(compressedImage);
  const fileExtension = compressedImage.includes('image/jpeg') ? 'jpg' : 'png';
  const filePath = `${userId}/${folder}/${fileName}.${fileExtension}`;

  const alternateExtension = fileExtension === 'jpg' ? 'png' : 'jpg';
  const alternateFilePath = `${userId}/${folder}/${fileName}.${alternateExtension}`;
  await supabase.storage.from('virtual-stylist').remove([alternateFilePath]);

  const { data, error } = await supabase.storage
    .from('virtual-stylist')
    .upload(filePath, blob, {
      contentType: compressedImage.includes('image/jpeg') ? 'image/jpeg' : 'image/png',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('virtual-stylist')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};

const deleteImageFromStorage = async (photoUrl: string): Promise<void> => {
  if (!supabase || !photoUrl) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const url = new URL(photoUrl);
  const pathParts = url.pathname.split('/');
  const filePath = pathParts.slice(pathParts.indexOf('virtual-stylist') + 1).join('/');

  await supabase.storage
    .from('virtual-stylist')
    .remove([filePath]);
};

const downloadImageFromStorage = async (photoUrl: string): Promise<string> => {
  if (!supabase || !photoUrl) throw new Error('Invalid parameters');

  const response = await fetch(photoUrl);
  if (!response.ok) throw new Error('Failed to download image');

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- AVATARS ---
export const saveAvatarToDb = async (avatar: AvatarProfile): Promise<AvatarProfile> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to save avatars');

    let photoUrl = avatar.photoBase64;

    if (avatar.photoBase64 && avatar.photoBase64.startsWith('data:')) {
      const shortName = avatar.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
      const fileName = `${Date.now()}-${shortName}`;
      photoUrl = await uploadImageToStorage(avatar.photoBase64, 'avatars', fileName);
    }

    let referencePhotoUrl = avatar.referencePhotoBase64;

    if (avatar.referencePhotoBase64 && avatar.referencePhotoBase64.startsWith('data:')) {
      const shortName = avatar.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
      const refFileName = `${Date.now()}-ref-${shortName}`;
      referencePhotoUrl = await uploadImageToStorage(avatar.referencePhotoBase64, 'avatars', refFileName);
    }

    const { data, error } = await supabase.from('avatars').insert([{
      user_id: userId,
      name: avatar.name,
      gender: avatar.gender,
      age_group: avatar.ageGroup,
      origin: avatar.origin,
      skin_tone: avatar.skinTone,
      hair_color: avatar.hairColor,
      hair_cut: avatar.hairCut,
      hair_texture: avatar.hairTexture,
      eye_color: avatar.eyeColor,
      build: avatar.build,
      additional_features: avatar.additionalFeatures,
      render_style: avatar.renderStyle,
      photo_url: photoUrl,
      reference_photo_url: referencePhotoUrl,
      generation_prompt: avatar.generationPrompt
    }]).select().single();
    if (error) throw error;
    return {
      ...avatar,
      id: data.id,
      photoBase64: photoUrl,
      referencePhotoBase64: referencePhotoUrl,
      created_at: data.created_at,
      parentAvatarId: data.parent_avatar_id
    };
  } else {
    const newAvatar = {
      ...avatar,
      id: avatar.id || crypto.randomUUID(),
      created_at: avatar.created_at || new Date().toISOString()
    };
    return await idbSave<AvatarProfile>(STORE_AVATARS, newAvatar);
  }
};

export const fetchAvatarsFromDb = async (): Promise<AvatarProfile[]> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return await idbGetAll<AvatarProfile>(STORE_AVATARS);
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      gender: item.gender,
      ageGroup: item.age_group,
      origin: item.origin,
      skinTone: item.skin_tone,
      hairColor: item.hair_color,
      hairCut: item.hair_cut,
      hairTexture: item.hair_texture,
      eyeColor: item.eye_color,
      build: item.build,
      additionalFeatures: item.additional_features,
      renderStyle: item.render_style ?? null,
      photoBase64: item.photo_url || item.photo_base64,
      referencePhotoBase64: item.reference_photo_url,
      created_at: item.created_at,
      parentAvatarId: item.parent_avatar_id,
      generationPrompt: item.generation_prompt
    }));
  }
  return await idbGetAll<AvatarProfile>(STORE_AVATARS);
};

export const getAvatarById = async (id: string): Promise<AvatarProfile | null> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      gender: data.gender,
      ageGroup: data.age_group,
      origin: data.origin,
      skinTone: data.skin_tone,
      hairColor: data.hair_color,
      hairCut: data.hair_cut,
      hairTexture: data.hair_texture,
      eyeColor: data.eye_color,
      build: data.build,
      additionalFeatures: data.additional_features,
      renderStyle: data.render_style ?? null,
      photoBase64: data.photo_url || data.photo_base64,
      referencePhotoBase64: data.reference_photo_url,
      created_at: data.created_at,
      parentAvatarId: data.parent_avatar_id,
      generationPrompt: data.generation_prompt
    };
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_AVATARS, 'readonly');
    const store = transaction.objectStore(STORE_AVATARS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteAvatarFromDb = async (id: string) => {
  if (supabase) {
    // Get the avatar to delete
    const avatar = await getAvatarById(id);

    // Delete photos from storage for the avatar being deleted
    if (avatar?.photoBase64 && avatar.photoBase64.startsWith('http')) {
      await deleteImageFromStorage(avatar.photoBase64);
    }
    if (avatar?.referencePhotoBase64 && avatar.referencePhotoBase64.startsWith('http')) {
      await deleteImageFromStorage(avatar.referencePhotoBase64);
    }

    // Delete the avatar from the database
    // Child avatars will have their parent_avatar_id set to NULL (ON DELETE SET NULL)
    // They are NOT deleted, only orphaned
    await supabase.from('avatars').delete().eq('id', id);
  }

  // Delete from IndexedDB
  await idbDelete(STORE_AVATARS, id);
};

export const updateAvatarInDb = async (id: string, updates: Partial<Omit<AvatarProfile, 'id' | 'created_at'>>): Promise<void> => {
  if (supabase) {
    let photoUrl = updates.photoBase64;

    if (updates.photoBase64 && updates.photoBase64.startsWith('data:')) {
      const avatar = await getAvatarById(id);
      if (avatar) {
        const shortName = (updates.name || avatar.name).slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
        const fileName = `${Date.now()}-${shortName}`;
        photoUrl = await uploadImageToStorage(updates.photoBase64, 'avatars', fileName);
      }
    }

    let referencePhotoUrl = updates.referencePhotoBase64;

    if (updates.referencePhotoBase64 && updates.referencePhotoBase64.startsWith('data:')) {
      const avatar = await getAvatarById(id);
      if (avatar) {
        const shortName = (updates.name || avatar.name).slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
        const refFileName = `${Date.now()}-ref-${shortName}`;
        referencePhotoUrl = await uploadImageToStorage(updates.referencePhotoBase64, 'avatars', refFileName);
      }
    }

    const { error } = await supabase.from('avatars').update({
      name: updates.name,
      gender: updates.gender,
      age_group: updates.ageGroup,
      origin: updates.origin,
      skin_tone: updates.skinTone,
      hair_color: updates.hairColor,
      hair_cut: updates.hairCut,
      hair_texture: updates.hairTexture,
      eye_color: updates.eyeColor,
      build: updates.build,
      additional_features: updates.additionalFeatures,
      render_style: updates.renderStyle,
      photo_url: photoUrl,
      reference_photo_url: referencePhotoUrl,
      generation_prompt: updates.generationPrompt
    }).eq('id', id);
    if (error) throw error;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_AVATARS, 'readwrite');
    const store = transaction.objectStore(STORE_AVATARS);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const avatar = getRequest.result;
      if (avatar) {
        const updated = { ...avatar, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const createAvatarVersion = async (parentAvatar: AvatarProfile, newName: string): Promise<AvatarProfile> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to create avatar versions');

    let photoUrl = parentAvatar.photoBase64;
    const shortName = newName.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `${Date.now()}-${shortName}`;

    if (parentAvatar.photoBase64) {
      if (parentAvatar.photoBase64.startsWith('data:')) {
        photoUrl = await uploadImageToStorage(parentAvatar.photoBase64, 'avatars', fileName);
      } else if (parentAvatar.photoBase64.startsWith('http')) {
        const base64Image = await downloadImageFromStorage(parentAvatar.photoBase64);
        photoUrl = await uploadImageToStorage(base64Image, 'avatars', fileName);
      }
    }

    let referencePhotoUrl = parentAvatar.referencePhotoBase64;
    if (parentAvatar.referencePhotoBase64) {
      const refFileName = `${Date.now()}-ref-${shortName}`;
      if (parentAvatar.referencePhotoBase64.startsWith('data:')) {
        referencePhotoUrl = await uploadImageToStorage(parentAvatar.referencePhotoBase64, 'avatars', refFileName);
      } else if (parentAvatar.referencePhotoBase64.startsWith('http')) {
        const base64Image = await downloadImageFromStorage(parentAvatar.referencePhotoBase64);
        referencePhotoUrl = await uploadImageToStorage(base64Image, 'avatars', refFileName);
      }
    }

    const { data, error } = await supabase.from('avatars').insert([{
      user_id: userId,
      name: newName,
      gender: parentAvatar.gender,
      age_group: parentAvatar.ageGroup,
      origin: parentAvatar.origin,
      skin_tone: parentAvatar.skinTone,
      hair_color: parentAvatar.hairColor,
      hair_cut: parentAvatar.hairCut,
      hair_texture: parentAvatar.hairTexture,
      eye_color: parentAvatar.eyeColor,
      build: parentAvatar.build,
      additional_features: parentAvatar.additionalFeatures,
      render_style: parentAvatar.renderStyle,
      photo_url: photoUrl,
      reference_photo_url: referencePhotoUrl,
      parent_avatar_id: parentAvatar.id,
      generation_prompt: parentAvatar.generationPrompt
    }]).select().single();
    if (error) throw error;
    return {
      ...parentAvatar,
      id: data.id,
      name: newName,
      photoBase64: photoUrl,
      referencePhotoBase64: referencePhotoUrl,
      created_at: data.created_at,
      parentAvatarId: data.parent_avatar_id
    };
  } else {
    const newAvatar = {
      ...parentAvatar,
      id: crypto.randomUUID(),
      name: newName,
      created_at: new Date().toISOString()
    };
    return await idbSave<AvatarProfile>(STORE_AVATARS, newAvatar);
  }
};

export const getAvatarVersions = async (parentId: string): Promise<AvatarProfile[]> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('parent_avatar_id', parentId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      gender: item.gender,
      ageGroup: item.age_group,
      origin: item.origin,
      skinTone: item.skin_tone,
      hairColor: item.hair_color,
      hairCut: item.hair_cut,
      hairTexture: item.hair_texture,
      eyeColor: item.eye_color,
      build: item.build,
      additionalFeatures: item.additional_features,
      renderStyle: item.render_style ?? null,
      photoBase64: item.photo_url || item.photo_base64,
      created_at: item.created_at
    }));
  }
  return [];
};

// --- LOCATIONS ---
export const saveLocationToDb = async (loc: LocationProfile): Promise<LocationProfile> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to save locations');

    let photoUrl = loc.photoBase64;
    if (loc.photoBase64 && loc.photoBase64.startsWith('data:')) {
      const shortName = loc.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
      const fileName = `${Date.now()}-${shortName}`;
      photoUrl = await uploadImageToStorage(loc.photoBase64, 'locations', fileName);
    }

    const { data, error } = await supabase.from('locations').insert([{
      user_id: userId,
      name: loc.name,
      description: loc.description,
      photo_url: photoUrl,
      generation_prompt: loc.generationPrompt
    }]).select().single();
    if (error) throw error;
    return { ...loc, id: data.id, photoBase64: photoUrl, created_at: data.created_at, generationPrompt: data.generation_prompt };
  } else {
    const newLoc = {
      ...loc,
      id: loc.id || crypto.randomUUID(),
      created_at: loc.created_at || new Date().toISOString()
    };
    return await idbSave<LocationProfile>(STORE_LOCATIONS, newLoc);
  }
};

export const fetchLocationsFromDb = async (): Promise<LocationProfile[]> => {
  if (supabase) {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return await idbGetAll<LocationProfile>(STORE_LOCATIONS);
    return data.map((item: any) => ({
      id: item.id, name: item.name, description: item.description,
      photoBase64: item.photo_url || item.photo_base64, created_at: item.created_at,
      generationPrompt: item.generation_prompt
    }));
  }
  return await idbGetAll<LocationProfile>(STORE_LOCATIONS);
};

export const deleteLocationFromDb = async (id: string) => {
  if (supabase) {
    const { data } = await supabase.from('locations').select('photo_url, reference_photo_url').eq('id', id).maybeSingle();
    if (data?.photo_url && data.photo_url.startsWith('http')) {
      await deleteImageFromStorage(data.photo_url);
    }
    if (data?.reference_photo_url && data.reference_photo_url.startsWith('http')) {
      await deleteImageFromStorage(data.reference_photo_url);
    }
    await supabase.from('locations').delete().eq('id', id);
  }
  await idbDelete(STORE_LOCATIONS, id);
};

export const updateLocationInDb = async (id: string, updates: { name?: string; description?: string; generationPrompt?: string }): Promise<void> => {
  if (supabase) {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.generationPrompt !== undefined) updateData.generation_prompt = updates.generationPrompt;

    const { error } = await supabase.from('locations').update(updateData).eq('id', id);
    if (error) throw error;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LOCATIONS, 'readwrite');
    const store = transaction.objectStore(STORE_LOCATIONS);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const location = getRequest.result;
      if (location) {
        const updated = { ...location, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// --- PRESETS ---
export const savePresetToDb = async (preset: Preset): Promise<Preset> => {
  // We prioritize local presets for simplicity of linking IDs
  const newPreset = {
    ...preset,
    id: preset.id || crypto.randomUUID(),
    created_at: preset.created_at || new Date().toISOString()
  };
  return await idbSave<Preset>(STORE_PRESETS, newPreset);
};

export const fetchPresetsFromDb = async (): Promise<Preset[]> => {
  return await idbGetAll<Preset>(STORE_PRESETS);
};

export const deletePresetFromDb = async (id: string) => {
  await idbDelete(STORE_PRESETS, id);
};

// --- EASYVINTED ARTICLES (Read-only) ---
export interface DressingArticle {
  id: string;
  title: string;
  brand: string;
  size: string;
  photos: string[];
  price: number;
  status: string;
}

export const fetchDressingArticles = async (): Promise<DressingArticle[]> => {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('articles')
    .select('id, title, brand, size, photos, price, status')
    .eq('user_id', userId)
    .in('status', ['draft', 'ready', 'scheduled', 'published', 'vinted_draft'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching dressing articles:', error);
    return [];
  }

  return data || [];
};

// --- DEFAULT AVATAR & LOCATION (Multi-Seller Support) ---
export const setDefaultAvatar = async (avatarId: string | null): Promise<void> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User must be authenticated');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.default_seller_id) {
    throw new Error('No default seller configured. Please set a default seller in EasyVinted settings.');
  }

  const { error } = await supabase
    .from('family_members')
    .update({ default_avatar_id: avatarId })
    .eq('id', profile.default_seller_id);

  if (error) throw error;
};

export const setDefaultLocation = async (locationId: string | null): Promise<void> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User must be authenticated');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.default_seller_id) {
    throw new Error('No default seller configured. Please set a default seller in EasyVinted settings.');
  }

  const { error } = await supabase
    .from('family_members')
    .update({ default_location_id: locationId })
    .eq('id', profile.default_seller_id);

  if (error) throw error;
};

export const getDefaultAvatarAndLocation = async (): Promise<{ defaultAvatarId: string | null; defaultLocationId: string | null; defaultSellerName?: string }> => {
  if (!supabase) return { defaultAvatarId: null, defaultLocationId: null };

  const userId = await getCurrentUserId();
  if (!userId) return { defaultAvatarId: null, defaultLocationId: null };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_seller_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.default_seller_id) {
    return { defaultAvatarId: null, defaultLocationId: null };
  }

  const { data: seller, error } = await supabase
    .from('family_members')
    .select('default_avatar_id, default_location_id, name')
    .eq('id', profile.default_seller_id)
    .maybeSingle();

  if (error || !seller) {
    return { defaultAvatarId: null, defaultLocationId: null };
  }

  return {
    defaultAvatarId: seller.default_avatar_id,
    defaultLocationId: seller.default_location_id,
    defaultSellerName: seller.name
  };
};

// --- STYLIST PHOTOS ---
export const saveStylistPhoto = async (photo: StylistPhoto): Promise<StylistPhoto> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User must be authenticated to save photos');

  let photoUrl = photo.photoBase64;
  if (photo.photoBase64 && photo.photoBase64.startsWith('data:')) {
    const shortName = photo.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `${Date.now()}-${shortName}`;
    photoUrl = await uploadImageToStorage(photo.photoBase64, 'photos', fileName);
  }

  const { data, error } = await supabase.from('stylist_photos').insert([{
    user_id: userId,
    name: photo.name,
    photo_url: photoUrl,
    avatar_id: photo.avatarId || null,
    location_id: photo.locationId || null,
    article_id: photo.articleId || null
  }]).select().single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    photoBase64: photoUrl,
    avatarId: data.avatar_id,
    locationId: data.location_id,
    articleId: data.article_id,
    created_at: data.created_at
  };
};

export const fetchStylistPhotos = async (): Promise<StylistPhoto[]> => {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('stylist_photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching stylist photos:', error);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    name: item.name,
    photoBase64: item.photo_url || item.photo_base64,
    avatarId: item.avatar_id,
    locationId: item.location_id,
    articleId: item.article_id,
    created_at: item.created_at
  }));
};

export const deleteStylistPhoto = async (id: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data } = await supabase.from('stylist_photos').select('photo_url').eq('id', id).maybeSingle();
  if (data?.photo_url && data.photo_url.startsWith('http')) {
    await deleteImageFromStorage(data.photo_url);
  }

  const { error } = await supabase.from('stylist_photos').delete().eq('id', id);
  if (error) throw error;
};
