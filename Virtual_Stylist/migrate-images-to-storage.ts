import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const base64ToBlob = (base64: string): Blob => {
  const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
};

const uploadImageToStorage = async (
  base64Image: string,
  folder: string,
  fileName: string,
  userId: string
): Promise<string> => {
  const blob = base64ToBlob(base64Image);
  const filePath = `${userId}/${folder}/${fileName}.png`;

  const { error } = await supabase.storage
    .from('virtual-stylist')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('virtual-stylist')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};

async function migrateAvatars() {
  console.log('🔄 Migrating avatars...');

  const { data: avatars, error } = await supabase
    .from('avatars')
    .select('id, name, photo_base64, photo_url, user_id')
    .is('photo_url', null)
    .not('photo_base64', 'is', null);

  if (error) {
    console.error('Error fetching avatars:', error);
    return;
  }

  console.log(`Found ${avatars.length} avatars to migrate`);

  for (const avatar of avatars) {
    try {
      let base64Data = avatar.photo_base64;

      if (!base64Data.startsWith('data:')) {
        base64Data = `data:image/png;base64,${base64Data}`;
      }

      const fileName = `${Date.now()}-${avatar.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const photoUrl = await uploadImageToStorage(
        base64Data,
        'avatars',
        fileName,
        avatar.user_id
      );

      await supabase
        .from('avatars')
        .update({ photo_url: photoUrl, photo_base64: null })
        .eq('id', avatar.id);

      console.log(`✅ Migrated avatar: ${avatar.name}`);
    } catch (err) {
      console.error(`❌ Failed to migrate avatar ${avatar.name}:`, err);
    }
  }
}

async function migrateLocations() {
  console.log('🔄 Migrating locations...');

  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, photo_base64, photo_url, user_id')
    .is('photo_url', null)
    .not('photo_base64', 'is', null);

  if (error) {
    console.error('Error fetching locations:', error);
    return;
  }

  console.log(`Found ${locations.length} locations to migrate`);

  for (const location of locations) {
    try {
      let base64Data = location.photo_base64;

      if (!base64Data.startsWith('data:')) {
        base64Data = `data:image/png;base64,${base64Data}`;
      }

      const fileName = `${Date.now()}-${location.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const photoUrl = await uploadImageToStorage(
        base64Data,
        'locations',
        fileName,
        location.user_id
      );

      await supabase
        .from('locations')
        .update({ photo_url: photoUrl, photo_base64: null })
        .eq('id', location.id);

      console.log(`✅ Migrated location: ${location.name}`);
    } catch (err) {
      console.error(`❌ Failed to migrate location ${location.name}:`, err);
    }
  }
}

async function migrateStylistPhotos() {
  console.log('🔄 Migrating stylist photos...');

  const { data: photos, error } = await supabase
    .from('stylist_photos')
    .select('id, name, photo_base64, photo_url, user_id')
    .is('photo_url', null)
    .not('photo_base64', 'is', null);

  if (error) {
    console.error('Error fetching stylist photos:', error);
    return;
  }

  console.log(`Found ${photos.length} stylist photos to migrate`);

  for (const photo of photos) {
    try {
      let base64Data = photo.photo_base64;

      if (!base64Data.startsWith('data:')) {
        base64Data = `data:image/png;base64,${base64Data}`;
      }

      console.log(`  Uploading photo: ${photo.name} (${photo.id})`);
      const fileName = `${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const photoUrl = await uploadImageToStorage(
        base64Data,
        'photos',
        fileName,
        photo.user_id
      );

      console.log(`  URL generated: ${photoUrl}`);

      const { error: updateError } = await supabase
        .from('stylist_photos')
        .update({ photo_url: photoUrl, photo_base64: null })
        .eq('id', photo.id);

      if (updateError) {
        console.error(`  Update error:`, updateError);
        throw updateError;
      }

      console.log(`✅ Migrated photo: ${photo.name}`);
    } catch (err) {
      console.error(`❌ Failed to migrate photo ${photo.name}:`, err);
    }
  }
}

async function main() {
  console.log('🚀 Starting migration to Supabase Storage...\n');

  try {
    await migrateAvatars();
    await migrateLocations();
    await migrateStylistPhotos();

    console.log('\n✨ Migration completed successfully!');
    console.log('📊 Check your database size - it should be significantly reduced.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
