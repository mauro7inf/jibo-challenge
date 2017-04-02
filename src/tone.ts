/// <reference path="../typings/index.d.ts" />
/// <reference path="./audio.ts" />

import {AudioPlayer} from './audio';

const sampleRate = 44100;
const mspa = 1000/sampleRate; // ms per audio frame

export class Tone {
  static player = new AudioPlayer();

  isPlaying: boolean;
  frequency: number; // s^-1
  duration: number; // ms
  gain: number;
  frame: number;
  phase: number;
  envelope: {
    attack: number, // ms
    decay: number,
    release: number, // after duration
    attackGain: number, // peak size for attack
  }
  attackUntilFrame: number;
  decayUntilFrame: number;
  sustainUntilFrame: number;
  releaseUntilFrame: number;

  constructor(frequency: number, duration: number, gain: number) {
    // there could be a lot more features, but we don't need them here
    this.frequency = frequency;
    this.duration = duration; // ms
    this.gain = gain;
    this.isPlaying = false;
    this.frame = 0;
    this.phase = Math.random()*2.0*Math.PI;
    this.envelope = {
      attack: 10,
      decay: 10,
      release: 20,
      attackGain: 2
    };
  }

  calculateFrames() {
    this.attackUntilFrame = this.envelope.attack/mspa;
    this.decayUntilFrame = this.attackUntilFrame + this.envelope.decay/mspa;
    this.sustainUntilFrame = this.duration/mspa;
    this.releaseUntilFrame = this.sustainUntilFrame + this.envelope.release/mspa;
  }

  play() {
    this.calculateFrames();
    this.isPlaying = true;
    Tone.player.notes.push(this);
  }

  generateEnvelope() {
    if (this.frame < this.attackUntilFrame) {
      return (this.frame/this.attackUntilFrame)*this.envelope.attackGain;
    } else if (this.frame < this.decayUntilFrame) {
      return (
          (this.frame - this.attackUntilFrame)/
          (this.decayUntilFrame - this.attackUntilFrame)
        )*(1 - this.envelope.attackGain) +
        this.envelope.attackGain;
    } else if (this.frame < this.sustainUntilFrame) {
      return 1.0;
    } else if (this.frame < this.releaseUntilFrame) {
      return 1.0 - (this.frame - this.sustainUntilFrame)/
        (this.releaseUntilFrame - this.sustainUntilFrame);
    } else {
      this.isPlaying = false;
      return 0;
    }
  }

  generate() {
    // triangle wave -- we could use a variety but we won't
    let sample = 2.0*Math.abs((this.phase/Math.PI) - 1.0) - 1.0;
    sample *= this.gain*this.generateEnvelope();
    // update
    this.phase += Math.PI*this.frequency*mspa/500;
    while (this.phase > 2*Math.PI) {
      this.phase -= 2*Math.PI;
    }
    this.frame++;

    return sample;
  }
}
