class Helper {
  static deepArrayFlatten(arr) {
    return [].concat(...arr.map(v=>Array.isArray(v) ? Helper.deepArrayFlatten(v) : v));
  }

  static hexStrip0x(str) {
      return str.replace(/^0x/, '');
  }

  static hexWith0x(hexStr) {
      if(0 > hexStr.indexOf('0x')){
          return `0x${hexStr}`;
      }
      return hexStr;
  }

  static defineProperty(obj, property) {
      let value;
      Object.defineProperty(obj, property, {
          get: ()  => value,
          set: val => value = val,
          enumerable: true
      });
  }

  static async sleep(time) {
      return new Promise(function (resolve, reject) {
          setTimeout(function () {
              resolve();
          }, time);
      });
  };
}

exports.Helper = Helper;