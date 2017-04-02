/// <reference path="../typings/index.d.ts" />
/// <reference path="./tone.ts" />

import {Tone} from './tone';

export class AudioPlayer {
  ctx: AudioContext;
  notes: Tone[];
  node: ScriptProcessorNode;

  constructor() {
    this.ctx = new AudioContext();
    this.notes = [];
    this.node = this.ctx.createScriptProcessor(1024, 0, 1); // mono, no buffer
    this.node.connect(this.ctx.destination);
    this.node.onaudioprocess = this.callback.bind(this);
  }

  callback(e) {
    let outputData = e.outputBuffer.getChannelData(0);
    for (let sample = 0; sample < e.outputBuffer.length; sample++) {
      outputData[sample] = 0;
      for (let i = 0; i < this.notes.length; i++) {
        if (this.notes[i] && this.notes[i].isPlaying) {
          outputData[sample] += this.notes[i].generate();
        }
      }
    }
    for (let i = 0; i < this.notes.length; i++) {
      if (!(this.notes[i].isPlaying)) {
        this.notes.splice(i, 1);
        i--;
      }
    }
  }
}
