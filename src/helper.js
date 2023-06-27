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
  }

  static parseError(err) {
    if (err.message) {
      return (err.message);
    } else if (err.reason) {
      return (err.reason);
    } else if (err.error && err.error.details && err.error.details.length && err.error.details[0].message) {
      return (err.error.details[0].message);
    } else if (err.response && err.response.data && err.response.data.error) {
      return err.response.data.error;
    } else if (err.processed && err.processed.except && err.processed.except.message) {
      return (err.processed.except.message);
    } else  if (err.name) {
      return (err.name);
    } else {
      return err;
    }
  }

}

exports.Helper = Helper;