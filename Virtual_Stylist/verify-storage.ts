import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface VerificationResult {
  category: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function verifyBucketConfiguration() {
  console.log('\n🔍 Verification du bucket virtual-stylist...\n');

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      results.push({
        category: 'Bucket',
        status: 'ERROR',
        message: 'Impossible de lister les buckets',
        details: error.message
      });
      return;
    }

    const virtualStylistBucket = buckets.find(b => b.id === 'virtual-stylist');

    if (!virtualStylistBucket) {
      results.push({
        category: 'Bucket',
        status: 'ERROR',
        message: 'Le bucket virtual-stylist n\'existe pas'
      });
      return;
    }

    results.push({
      category: 'Bucket',
      status: 'OK',
      message: `Bucket trouvé (${virtualStylistBucket.public ? 'PUBLIC' : 'PRIVATE'})`,
      details: {
        name: virtualStylistBucket.name,
        public: virtualStylistBucket.public,
        created_at: virtualStylistBucket.created_at
      }
    });

    if (!virtualStylistBucket.public) {
      results.push({
        category: 'Bucket Configuration',
        status: 'WARNING',
        message: 'Le bucket est en mode PRIVATE, les images ne seront pas visibles publiquement'
      });
    }
  } catch (error: any) {
    results.push({
      category: 'Bucket',
      status: 'ERROR',
      message: 'Erreur lors de la vérification du bucket',
      details: error.message
    });
  }
}

async function verifyAvatars() {
  console.log('🎭 Vérification des avatars...\n');

  try {
    const { data: avatars, error } = await supabase
      .from('avatars')
      .select('id, name, photo_url')
      .limit(10);

    if (error) {
      results.push({
        category: 'Avatars',
        status: 'ERROR',
        message: 'Impossible de récupérer les avatars',
        details: error.message
      });
      return;
    }

    results.push({
      category: 'Avatars',
      status: 'OK',
      message: `${avatars.length} avatar(s) trouvé(s)`,
      details: avatars.map(a => ({
        id: a.id,
        name: a.name,
        has_photo: !!a.photo_url,
        photo_url: a.photo_url?.substring(0, 100) + '...'
      }))
    });

    for (const avatar of avatars.slice(0, 3)) {
      if (avatar.photo_url) {
        try {
          const response = await fetch(avatar.photo_url, { method: 'HEAD' });
          results.push({
            category: 'Avatar Image',
            status: response.ok ? 'OK' : 'ERROR',
            message: `${avatar.name}: ${response.status} ${response.statusText}`,
            details: {
              url: avatar.photo_url,
              status: response.status,
              content_type: response.headers.get('content-type')
            }
          });
        } catch (error: any) {
          results.push({
            category: 'Avatar Image',
            status: 'ERROR',
            message: `${avatar.name}: Erreur de connexion`,
            details: error.message
          });
        }
      }
    }
  } catch (error: any) {
    results.push({
      category: 'Avatars',
      status: 'ERROR',
      message: 'Erreur lors de la vérification des avatars',
      details: error.message
    });
  }
}

async function verifyLocations() {
  console.log('📍 Vérification des locations...\n');

  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name, photo_url')
      .limit(10);

    if (error) {
      results.push({
        category: 'Locations',
        status: 'ERROR',
        message: 'Impossible de récupérer les locations',
        details: error.message
      });
      return;
    }

    results.push({
      category: 'Locations',
      status: 'OK',
      message: `${locations.length} location(s) trouvée(s)`,
      details: locations.map(l => ({
        id: l.id,
        name: l.name,
        has_photo: !!l.photo_url,
        photo_url: l.photo_url?.substring(0, 100) + '...'
      }))
    });

    for (const location of locations.slice(0, 3)) {
      if (location.photo_url) {
        try {
          const response = await fetch(location.photo_url, { method: 'HEAD' });
          results.push({
            category: 'Location Image',
            status: response.ok ? 'OK' : 'ERROR',
            message: `${location.name}: ${response.status} ${response.statusText}`,
            details: {
              url: location.photo_url,
              status: response.status,
              content_type: response.headers.get('content-type')
            }
          });
        } catch (error: any) {
          results.push({
            category: 'Location Image',
            status: 'ERROR',
            message: `${location.name}: Erreur de connexion`,
            details: error.message
          });
        }
      }
    }
  } catch (error: any) {
    results.push({
      category: 'Locations',
      status: 'ERROR',
      message: 'Erreur lors de la vérification des locations',
      details: error.message
    });
  }
}

async function verifyStylistPhotos() {
  console.log('📸 Vérification des photos stylist...\n');

  try {
    const { data: photos, error } = await supabase
      .from('stylist_photos')
      .select('id, name, photo_url')
      .limit(10);

    if (error) {
      results.push({
        category: 'Stylist Photos',
        status: 'ERROR',
        message: 'Impossible de récupérer les photos',
        details: error.message
      });
      return;
    }

    results.push({
      category: 'Stylist Photos',
      status: 'OK',
      message: `${photos.length} photo(s) trouvée(s)`
    });
  } catch (error: any) {
    results.push({
      category: 'Stylist Photos',
      status: 'ERROR',
      message: 'Erreur lors de la vérification des photos',
      details: error.message
    });
  }
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 RAPPORT DE VERIFICATION - VIRTUAL STYLIST STORAGE');
  console.log('='.repeat(80) + '\n');

  const okCount = results.filter(r => r.status === 'OK').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;

  for (const result of results) {
    const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} [${result.category}] ${result.message}`);

    if (result.details && process.argv.includes('--verbose')) {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`✅ OK: ${okCount} | ⚠️  WARNING: ${warningCount} | ❌ ERROR: ${errorCount}`);
  console.log('='.repeat(80) + '\n');

  if (errorCount > 0) {
    console.log('⚠️  Des erreurs ont été détectées. Veuillez vérifier la configuration du bucket et les politiques RLS.\n');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('⚠️  Warnings détectés. Tout fonctionne mais il y a des recommandations.\n');
  } else {
    console.log('✨ Tout est en ordre ! Le storage Virtual Stylist fonctionne correctement.\n');
  }
}

async function main() {
  console.log('🚀 Démarrage de la vérification du storage Virtual Stylist...');

  await verifyBucketConfiguration();
  await verifyAvatars();
  await verifyLocations();
  await verifyStylistPhotos();

  printResults();
}

main().catch(console.error);
