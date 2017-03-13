import "jest"
import {Coder} from '../src/helpers/crypto';


describe("testing crypto.ts", () => {
  let coder: Coder;

  beforeAll(() => {
      coder = new Coder(new Int32Array([0,0,0,0]));
  });

  it("encrypting empty", () => {
      let iv_coded_tag = coder.encryptWithIV([0,0,0,0,0,0,0,0,0,0,0,0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        []);
      let expected_coded = [3, 136, 218, 206, 96, 182, 163, 146, 243, 40, 194, 185, 113, 178, 254, 120];
      console.warn("Produced: ", iv_coded_tag[1]);
      console.warn("Expected", expected_coded);
      expect(iv_coded_tag[1]).toEqual(expected_coded);
  });
});