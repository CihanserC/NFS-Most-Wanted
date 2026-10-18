import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
  uniform float uStops;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = vec4(inputColor.rgb * exp2(uStops), inputColor.a);
  }
`;

/** Ton eşlemeden önce (HDR) pozlama telafisi: renkleri 2^stops ile çarpar. */
export class ExposureEffect extends Effect {
  constructor(stops = 0) {
    super('ExposureEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['uStops', new Uniform(stops)]]),
    });
  }

  get stops(): number {
    return (this.uniforms.get('uStops') as Uniform<number>).value;
  }

  set stops(value: number) {
    (this.uniforms.get('uStops') as Uniform<number>).value = value;
  }
}
