'use strict';

module.exports = ShellLoader;

const evaluate = require('./evaluate');

const numberTypes = new Set(['string', 'number']);
const isNumber = n => numberTypes.has(typeof n) && !isNaN(parseInt(n, 10)) && isFinite(n);

function parseArgs(cmdPath, args, config) {
    if (args == null) throw new Error('invalid arguments');
    if (Array.isArray(args)) return args.map(v => parseArgs(cmdPath, v, config));
    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        return [ args.command, ...parseArgs(cmdPath.slice(1), args.args || [], config[args.command] || {}) ];
    }
    if (typeof args === 'string') args = { name: args };
    if (config[args.name] || [ 'variable', 'template' ].includes(args.type)) {
        let { name, type = 'option' } = args;
        const value = String(config[name]);
        let result;
        switch (type) {
            case 'value':
                result = value;
                break;
            case 'option':
                result = [ `--${name}`, value ];
                break;
            case 'flag':
                result = `-${name}`;
                break;
            case 'variable':
                config[name] = value;
                return;
            case 'template':
                result = Array.isArray(args.template)
                    ? args.template.map(v => evaluate(`\`${v}\``, config))
                    : evaluate(`\`${args.template}\``, config);
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
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

    function loader(cmdPath, config) {
        cmdPath = Array.isArray(cmdPath)
            ? cmdPath
            : cmdPath.split('.');
        const args = parseArgs(cmdPath.slice(1), spec, config).flat(Infinity).filter(v => v);
        return [ command, ...args ];
    }

    return loader;
}
