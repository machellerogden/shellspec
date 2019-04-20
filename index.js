'use strict';

module.exports = ShellLoader;

const camelCase = require('lodash/camelCase');
const mapKeys = require('lodash/mapKeys');

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
        let result;
        switch (type) {
            case 'command':
                result = name;
                break;
            case 'option':
                result = `--${name}`;
                break;
            case 'flag':
                result = `-${name}`;
                break;
            default:
                throw new Error('invalid argument type');
        }
        return result;
    }
    throw new Error('invalid spec');
}

function ShellLoader(definition) {
    if (definition == null) throw new Error('invalid definition');

    const { spec } = definition;

    if (spec == null) throw new Error('invalid spec');

    function loader(config) {
        const args = parseArgs(spec, config).flat(Infinity);
        return args;
    }

    return loader;
}
