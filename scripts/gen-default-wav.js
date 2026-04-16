const fs = require('fs');
const path = require('path');

function createSineWav({
  sampleRate = 44100,
  durationSec = 1.2,
  frequency = 880,
  amplitude = 0.35,
} = {}) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 4, 'ascii');

  // fmt chunk
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // soft attack/release envelope to avoid clicks
    const attack = Math.min(1, t / 0.03);
    const release = Math.min(1, (durationSec - t) / 0.08);
    const env = Math.max(0, Math.min(attack, release));
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude * env;
    const pcm = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.floor(pcm * 32767), 44 + i * 2);
  }

  return buffer;
}

function main() {
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'public', 'sounds');
  const outFile = path.join(outDir, 'default.wav');
  fs.mkdirSync(outDir, { recursive: true });
  const wav = createSineWav();
  fs.writeFileSync(outFile, wav);
  console.log(`[gen-default-wav] Wrote ${outFile}`);
}

main();

