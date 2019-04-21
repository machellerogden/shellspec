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
    if (args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        return [ args.command, ...parseArgs(args.args || [], config[args.command]) ];
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

    let command;

    if (!Array.isArray(spec)) {
        if (!spec.command) throw new Error('invalid spec - missing main command definition');
        command = spec.command;
        spec = spec.args || [];
    } else {
        command = spec[0];
        spec = spec.slice(1);
    }

    function loader(config) {
        const args = parseArgs(spec, config).flat(Infinity).filter(v => v);
        return [ command, ...args ];
    }

    return loader;
}
