/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2019 Truman Kilen, Nathan Dinsmore, and Adroitwhiz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// prettier-ignore
const ADPCM_STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107,
  118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
  1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894,
  6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767
];

const ADPCM_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

export default function decodeADPCMAudio(ab, audioContext) {
  const dv = new DataView(ab);
  // WAV magic number
  if (dv.getUint32(0) !== 0x52494646 || dv.getUint32(8) !== 0x57415645) {
    return Promise.reject(new Error("Unrecognized audio format"));
  }

  const blocks = {};
  const l = dv.byteLength - 8;
  let i = 12;
  while (i < l) {
    blocks[
      String.fromCharCode(
        dv.getUint8(i),
        dv.getUint8(i + 1),
        dv.getUint8(i + 2),
        dv.getUint8(i + 3)
      )
    ] = i;
    i += 8 + dv.getUint32(i + 4, true);
  }

  const format = dv.getUint16(20, true);
  const sampleRate = dv.getUint32(24, true);

  if (format === 17) {
    const samplesPerBlock = dv.getUint16(38, true);
    const blockSize = (samplesPerBlock - 1) / 2 + 4;

    const frameCount = dv.getUint32(blocks.fact + 8, true);

    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    let sample;
    let index = 0;
    let step, code, delta;
    let lastByte = -1;

    const offset = blocks.data + 8;
    let i = offset;
    let j = 0;
    // eslint-disable-next-line
    while (true) {
      if ((i - offset) % blockSize === 0 && lastByte < 0) {
        if (i >= dv.byteLength) break;
        sample = dv.getInt16(i, true);
        i += 2;
        index = dv.getUint8(i);
        i += 1;
        i++;
        if (index > 88) index = 88;
        channel[j++] = sample / 32767;
      } else {
        if (lastByte < 0) {
          if (i >= dv.byteLength) break;
          lastByte = dv.getUint8(i);
          i += 1;
          code = lastByte & 0xf;
        } else {
          code = (lastByte >> 4) & 0xf;
          lastByte = -1;
        }
        step = ADPCM_STEPS[index];
        delta = 0;
        if (code & 4) delta += step;
        if (code & 2) delta += step >> 1;
        if (code & 1) delta += step >> 2;
        delta += step >> 3;
        index += ADPCM_INDEX[code];
        if (index > 88) index = 88;
        if (index < 0) index = 0;
        sample += code & 8 ? -delta : delta;
        if (sample > 32767) sample = 32767;
        if (sample < -32768) sample = -32768;
        channel[j++] = sample / 32768;
      }
    }
    return Promise.resolve(buffer);
  }
  return Promise.reject(new Error(`Unrecognized WAV format ${format}`));
}

export function isWavData(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  return (
    dataView.getUint32(0) === 0x52494646 && dataView.getUint32(8) === 0x57415645
  );
}

export function isADPCMData(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const format = dataView.getUint16(20, true);
  return isWavData(arrayBuffer) && format === 17;
}
