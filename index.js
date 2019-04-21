'use strict';

module.exports = ShellLoader;

const camelCase = require('lodash/camelCase');
const mapKeys = require('lodash/mapKeys');

const numberTypes = new Set(['string', 'number']);
const isNumber = n => numberTypes.has(typeof n) && !isNaN(parseInt(n, 10)) && isFinite(n);

function parseArgs(args, config) {
    if (args == null) throw new Error('invalid arguments');
    if (typeof args === 'string') return args;
    if (Array.isArray(args)) return args.map(v => parseArgs(v, config));
    if (args.main && args.main.command) {
        if (typeof args.main.command !== 'string') throw new Error('invalid spec - command must be a string');
        return [ args.main.command, ...parseArgs(args.main.args || [], config[args.main.command]) ];
    }
    if (config[args.name]) {
        let { name, type = 'option' } = args;
        const value = String(config[name]);
        let result;
        switch (type) {
            case 'command':
                result = name;
                break;
            case 'option':
                result = [ `--${name}`, value ];
                break;
            case 'flag':
                result = `-${name}`;
                break;
            default:
                throw new Error('invalid argument type');
        }
        return result;
    }
    return;
}

function ShellLoader(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');

    let main;

    if (!Array.isArray(spec)) {
        if (!spec.main || !spec.main.command) throw new Error('invalid spec - missing main command definition');
        main = spec.main.command;
        spec = spec.main.args || [];
    } else {
        main = spec[0];
        spec = spec.slice(1);
    }

    function loader(config) {
        const args = parseArgs(spec, config).flat(Infinity).filter(v => v);
        return [ main, ...args ];
    }

    return loader;
}
