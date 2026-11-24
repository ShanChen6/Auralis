/**
 * Bộ trộn âm thanh môi trường bằng Web Audio API.
 * Tất cả âm thanh được tổng hợp ngay trên trình duyệt (không cần tải file):
 *  - Mưa rơi: nhiễu hồng lọc dải + lớp "lộp độp" điều biên ngẫu nhiên
 *  - Lửa trại: nhiễu nâu trầm + tiếng tí tách ngẫu nhiên
 *  - Sóng biển: nhiễu hồng với âm lượng & độ sáng dâng/rút theo chu kỳ ~12s
 */

export type SoundscapeChannel = "rain" | "fire" | "waves";

export const SOUNDSCAPE_CHANNELS: { id: SoundscapeChannel; label: string }[] = [
  { id: "rain", label: "Mưa rơi" },
  { id: "fire", label: "Lửa trại" },
  { id: "waves", label: "Sóng biển" },
];

type NoiseColor = "white" | "pink" | "brown";

function createNoiseBuffer(ctx: AudioContext, color: NoiseColor, seconds = 6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "white") {
        data[i] = white * 0.5;
      } else if (color === "pink") {
        // Bộ lọc Paul Kellet
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    // Làm mềm chỗ nối để vòng lặp không bị "tách"
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      data[i] *= g;
      data[length - 1 - i] *= g;
    }
  }
  return buffer;
}

function loopNoise(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

class Channel {
  readonly output: GainNode;
  private stopFns: (() => void)[] = [];

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly build: (ctx: AudioContext, out: GainNode) => () => void,
  ) {
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
  }

  get running() {
    return this.stopFns.length > 0;
  }

  setVolume(volume: number) {
    if (volume > 0 && !this.running) this.stopFns.push(this.build(this.ctx, this.output));
    this.output.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.4);
    if (volume === 0 && this.running) {
      const stops = this.stopFns;
      this.stopFns = [];
      // Đợi âm lượng hạ hết rồi mới dừng nguồn
      setTimeout(() => stops.forEach((stop) => stop()), 2000);
    }
  }
}

function buildRain(ctx: AudioContext, out: GainNode) {
  const pink = loopNoise(ctx, createNoiseBuffer(ctx, "pink"));
  const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 500 });
  const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 7000 });
  const bed = new GainNode(ctx, { gain: 0.9 });
  pink.connect(hp).connect(lp).connect(bed).connect(out);

  // Lớp "lộp độp": nhiễu trắng dải cao, điều biên bằng nhiễu chậm
  const white = loopNoise(ctx, createNoiseBuffer(ctx, "white", 3));
  const band = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 3200, Q: 0.8 });
  const patter = new GainNode(ctx, { gain: 0.12 });
  const mod = loopNoise(ctx, createNoiseBuffer(ctx, "brown", 4));
  const modDepth = new GainNode(ctx, { gain: 0.25 });
  mod.connect(modDepth).connect(patter.gain);
  white.connect(band).connect(patter).connect(out);

  [pink, white, mod].forEach((s) => s.start());
  return () => [pink, white, mod].forEach((s) => s.stop());
}

function buildFire(ctx: AudioContext, out: GainNode) {
  const brown = loopNoise(ctx, createNoiseBuffer(ctx, "brown"));
  const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 500 });
  const rumble = new GainNode(ctx, { gain: 0.7 });
  brown.connect(lp).connect(rumble).connect(out);
  brown.start();

  const crackleBuffer = createNoiseBuffer(ctx, "white", 0.05);
  const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 1800 });
  hp.connect(out);
  let timer: ReturnType<typeof setTimeout>;
  const crackle = () => {
    const pop = ctx.createBufferSource();
    pop.buffer = crackleBuffer;
    const env = new GainNode(ctx, { gain: 0 });
    const t = ctx.currentTime;
    const peak = 0.15 + Math.random() * 0.45;
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.01 + Math.random() * 0.05);
    pop.playbackRate.value = 0.6 + Math.random() * 1.2;
    pop.connect(env).connect(hp);
    pop.start(t);
    pop.stop(t + 0.08);
    // Tí tách thưa, đôi khi dồn vài tiếng liền
    timer = setTimeout(crackle, Math.random() < 0.3 ? 30 + Math.random() * 80 : 150 + Math.random() * 900);
  };
  crackle();
  return () => {
    clearTimeout(timer);
    brown.stop();
  };
}

function buildWaves(ctx: AudioContext, out: GainNode) {
  const pink = loopNoise(ctx, createNoiseBuffer(ctx, "pink", 8));
  const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 900, Q: 0.5 });
  const swell = new GainNode(ctx, { gain: 0.45 });
  pink.connect(lp).connect(swell).connect(out);

  const lfo = new OscillatorNode(ctx, { type: "sine", frequency: 1 / 12 });
  const ampDepth = new GainNode(ctx, { gain: 0.4 });
  const filterDepth = new GainNode(ctx, { gain: 700 });
  lfo.connect(ampDepth).connect(swell.gain);
  lfo.connect(filterDepth).connect(lp.frequency);

  pink.start();
  lfo.start();
  return () => {
    pink.stop();
    lfo.stop();
  };
}

const BUILDERS: Record<SoundscapeChannel, (ctx: AudioContext, out: GainNode) => () => void> = {
  rain: buildRain,
  fire: buildFire,
  waves: buildWaves,
};

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private channels = new Map<SoundscapeChannel, Channel>();

  /** Phải gọi từ thao tác người dùng (chính sách autoplay của trình duyệt) */
  setVolume(id: SoundscapeChannel, volume: number) {
    const ctx = (this.ctx ??= new AudioContext());
    if (ctx.state === "suspended") void ctx.resume();
    let channel = this.channels.get(id);
    if (!channel) {
      channel = new Channel(ctx, ctx.destination, BUILDERS[id]);
      this.channels.set(id, channel);
    }
    channel.setVolume(volume);
  }
}

let engine: SoundscapeEngine | null = null;
export function getSoundscape(): SoundscapeEngine {
  return (engine ??= new SoundscapeEngine());
}
