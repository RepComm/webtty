
export interface ModemSendInfo {
  time: number;
}

/**Linear interpolation between from and to, using 0.0 - 1.0 interpolant `by`*/
export const lerp = (from: number, to: number, by: number): number => {
  return from*(1-by)+to*by;
}

/**Performs the inverse of lerp
 * Will give you the interpolant given the interpolated number and its bounds (to and from)
 */
export const inverseLerp = (from: number, to: number, value: number): number => {
  return (value - from) / (to - from);
}

export class Modem {
  /**audio nodes used for modulation and demodulation*/
  private nodes: {
    ctx: AudioContext;
    /**received audio comes from this node*/
    input: AudioNode;
    /**outgoing audio goes to this node*/
    output: AudioNode;
    /**audio is generated with this node*/
    generator: OscillatorNode;

    generatorGate: GainNode;
    /**audio is processed for fft info with this node*/
    analyser: AnalyserNode;
  }

  private config: {
    /**tone frequency of a 0 in binary*/
    bitZeroFrequency: number,
    /**tone frequency of a 1 in binary*/
    bitOneFrequency: number,
    /**tones per second*/
    baudRate: number,
    frequencyWidth: number
  }

  private state: {
    outputAudioEndTime: number;
    frequencyData: Uint8Array;
  }

  constructor(ctx: AudioContext) {
    this.nodes = {
      ctx,
      analyser: ctx.createAnalyser(),
      generator: ctx.createOscillator(),
      generatorGate: ctx.createGain(),
      input: undefined,
      output: undefined
    };
    this.nodes.generator.start();
    this.nodes.generatorGate.gain.value = 0;
    this.nodes.generator.connect(this.nodes.generatorGate);

    let fftSize = 2048;

    this.nodes.analyser.fftSize = fftSize;
    this.nodes.analyser.smoothingTimeConstant = 0;

    this.config = {
      baudRate: 8, //8 bytes per second
      bitOneFrequency: 880,
      bitZeroFrequency: 440,
      frequencyWidth: 5
    };
    this.state = {
      outputAudioEndTime: 0,
      frequencyData: new Uint8Array(fftSize/2)
    };
  }
  /**the microphone, as it were, which is listened to for decoding audio to data*/
  setInputNode(node: AudioNode): this {
    if (this.nodes.input) this.nodes.input.disconnect();
    this.nodes.input = node;
    this.nodes.input.connect(this.nodes.analyser);
    return this;
  }
  /**the speaker, as it were, which is broadcast on for sending audio from data*/
  setOutputNode(node: AudioNode): this {
    if (this.nodes.output) this.nodes.generatorGate.disconnect();
    this.nodes.output = node;
    this.nodes.generatorGate.connect(this.nodes.output);
    return this;
  }
  setBitAtTime(bit: boolean, startTime: number) {
    if (bit) {
      this.nodes.generator.frequency.setValueAtTime(this.config.bitOneFrequency, startTime);
    } else {
      this.nodes.generator.frequency.setValueAtTime(this.config.bitZeroFrequency, startTime);
    }
  }
  pushBit(bit: boolean) {
    this.setBitAtTime(bit, this.state.outputAudioEndTime);
    this.state.outputAudioEndTime += 1 / this.config.baudRate;
  }
  getBitOfByte(byte: number, bitIndex: number): boolean {
    // let bitValue = (byte >>> bitIndex) & 0x01;
    // return bitValue === 1;
    return ((byte >>> bitIndex) & 0x01) === 1;
  }
  send(data: ArrayBuffer): Promise<ModemSendInfo> {
    return new Promise(async (_resolve, _reject) => {
      let result: ModemSendInfo = {
        time: data.byteLength * 8 * (1 / this.config.baudRate)
      };
      let view = new DataView(data);

      let byte: number;
      if (this.state.outputAudioEndTime < this.nodes.ctx.currentTime) {
        this.state.outputAudioEndTime = this.nodes.ctx.currentTime;
      }

      this.nodes.generatorGate.gain.setValueAtTime(1, this.nodes.ctx.currentTime);
      let bits = "";
      let bit = false;
      for (let i = 0; i < view.byteLength; i++) {
        byte = view.getUint8(i);

        for (let j = 0; j < 8; j++) {
          bit = this.getBitOfByte(byte, j);
          if (bit) {
            bits += "1";
          } else {
            bits += "0";
          }
          this.pushBit(bit);
        }
      }
      // console.log(bits);
      this.nodes.generatorGate.gain.setValueAtTime(0, this.state.outputAudioEndTime);

      _resolve(result);
    });
  }
  receive (): Promise<ArrayBuffer> {
    return new Promise(async (_resolve, _reject)=>{
      let nyquistFrequency = this.nodes.ctx.sampleRate / 2;
      let bitZeroBinIndex = Math.round(lerp(
        0,
        this.state.frequencyData.byteLength,
        this.config.bitZeroFrequency / nyquistFrequency
      ));

      let bitOneBinIndex = Math.round(lerp(
        0,
        this.state.frequencyData.byteLength,
        this.config.bitOneFrequency / nyquistFrequency
      ));

      let bitZeroTest = 0;
      let bitOneTest = 0;

      setInterval(()=>{
        this.nodes.analyser.getByteFrequencyData(this.state.frequencyData);

        bitZeroTest = this.state.frequencyData[bitZeroBinIndex];
        bitOneTest = this.state.frequencyData[bitOneBinIndex];

        // if (bitOneTest > 0 || bitZeroTest > 0) {
          if (bitOneTest > bitZeroTest) {
            console.log("1");
          } else {
            console.log("0");
          }
        // }


      }, 1000/this.config.baudRate);

    });
  }
}
