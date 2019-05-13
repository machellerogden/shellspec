'use strict';

import vm from 'vm';

const evaluate = (statement, context) => {
    if (typeof context !== 'object') context = {};
    const sanitizeContext = 'Object.setPrototypeOf(this, Object.prototype);';
    return vm.runInNewContext(`${sanitizeContext}${statement}`, vm.createContext(context, { codeGeneration: { strings: false, wasm: false }}));
};

export default evaluate;
