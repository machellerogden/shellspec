'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vm_1 = __importDefault(require("vm"));
const evaluate = (statement, context) => {
    if (typeof context !== 'object')
        context = {};
    const sanitizeContext = 'Object.setPrototypeOf(this, Object.prototype);';
    return vm_1.default.runInNewContext(`${sanitizeContext}${statement}`, vm_1.default.createContext(context, { codeGeneration: { strings: false, wasm: false } }));
};
exports.default = evaluate;
//# sourceMappingURL=evaluate.js.map