import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load data files
const songs = JSON.parse(readFileSync(path.join(__dirname, '../data/songs.json'), 'utf8'));
const rotations = JSON.parse(readFileSync(path.join(__dirname, '../data/rotations.json'), 'utf8'));

// Create a map for quick song lookup
const songMap = new Map(songs.map(song => [song.id, song]));

/**
 * Validates that all songIds in rotations exist in songs.json
 * and prints total duration per rotation
 */
function validateData() {
  let isValid = true;

  console.log('=== DELUXE SALOON — Data Validation ===\n');

  // Validate songs have required fields
  console.log('Validating songs.json...');
  for (const song of songs) {
    const requiredFields = ['id', 'title', 'artist', 'filename', 'duration', 'spotifyUrl', 'youtubeMusicUrl'];
    for (const field of requiredFields) {
      if (!song[field]) {
        console.error(`  ❌ Song ${song.id} missing field: ${field}`);
        isValid = false;
      }
    }
  }
  console.log(`  ✓ ${songs.length} songs validated\n`);

  // Validate rotations
  console.log('Validating rotations.json and calculating durations...');
  for (const rotation of rotations) {
    const requiredFields = ['id', 'name', 'displayName', 'startHourIST', 'endHourIST', 'sceneImage', 'songIds'];
    for (const field of requiredFields) {
      if (!rotation[field]) {
        console.error(`  ❌ Rotation ${rotation.id} missing field: ${field}`);
        isValid = false;
      }
    }

    // Calculate total duration
    let totalDuration = 0;
    let invalidSongRefs = [];

    for (const songId of rotation.songIds) {
      const song = songMap.get(songId);
      if (!song) {
        invalidSongRefs.push(songId);
        isValid = false;
      } else {
        totalDuration += song.duration;
      }
    }

    if (invalidSongRefs.length > 0) {
      console.error(`  ❌ Rotation ${rotation.id} references invalid songs: ${invalidSongRefs.join(', ')}`);
    }

    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const seconds = totalDuration % 60;

    console.log(`  ✓ ${rotation.displayName}`);
    console.log(`    Songs: ${rotation.songIds.length}, Duration: ${hours}h ${minutes}m ${seconds}s`);
  }

  console.log('\n=== Summary ===');
  if (isValid) {
    console.log('✓ All data is valid!');
    console.log(`  Total songs: ${songs.length}`);
    console.log(`  Total rotations: ${rotations.length}`);
  } else {
    console.log('❌ Data validation failed. Fix errors above.');
    process.exit(1);
  }
}

validateData();
