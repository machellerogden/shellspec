'use strict';

module.exports = ShellLoader;

const evaluate = require('./evaluate');
const inquirer = require('inquirer');

const numberTypes = new Set(['string', 'number']);
const isNumber = n => numberTypes.has(typeof n) && !isNaN(parseInt(n, 10)) && isFinite(n);

async function parseArgs(cmdPath, args, config, collections = {}) {
    if (args == null) throw new Error('invalid arguments');
    if (Array.isArray(args)) return await Promise.all(args.map(async v => await parseArgs(cmdPath, v, config, collections)));
    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextArgs = await parseArgs(cmdPath.slice(1), args.args || [], config[args.command] || {}, { ...collections, ...(args.collections || {}) });
        return [ args.command, ...nextArgs ];
    }
    if (typeof args === 'string') args = { name: args };
    config[args.name] = config[args.name] || args.default;
    if (config[args.name] == null && args.required) {
        const userInput = await inquirer.prompt([{
            name: args.name,
            type: 'input',
            message: args.name
        }]);
        config[args.name] = userInput[args.name];
    }
    if (config[args.name] || [ 'collection', 'variable', 'template' ].includes(args.type)) {
        let { name, type = 'option' } = args;
        const value = String(config[name]);
        let result;
        switch (type) {
            case 'collection':
                result = await Promise.all((collections[name] || []).map(async coll => await parseArgs(cmdPath, coll, config, collections)));
                break;
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
                break;
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
    let collections = {};

    if (!Array.isArray(spec)) {
        if (!spec.command) throw new Error('invalid spec - missing main command definition');
        command = spec.command;
        collections = spec.collections;
        spec = spec.args || [];
    } else {
        command = spec[0];
        spec = spec.slice(1);
    }

    async function loader(cmdPath, config = {}) {
        cmdPath = Array.isArray(cmdPath)
            ? cmdPath
            : cmdPath.split('.');
        const args = (await parseArgs(cmdPath.slice(1), spec, config, collections)).flat(Infinity).filter(v => v);
        return [ command, ...args ];
    }

    return loader;
}
