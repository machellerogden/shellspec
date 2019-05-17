'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const cloneDeep = require('lodash/cloneDeep');
const inquirer = require('inquirer');
const { merge } = require('sugarmerge');
const evaluate = require('./evaluate');
const child_process = require('child_process');

const seq = async p => await p.reduce(async (chain, fn) => Promise.resolve([
    ...(await chain),
    await fn()
]), Promise.resolve([]));

const getCollections = (obj, acc = {}) => typeof obj === 'object'
    ? Array.isArray(obj)
        ? {
            ...acc,
            ...obj.reduce((a, v) =>
                getCollections(v, a),
                {})
          }
        : {
            ...acc,
            ...Object.entries(obj).reduce((a, [ k, v ]) =>
                k === 'collections'
                    ? { ...a, ...v }
                    : getCollections(v, a),
                {})
          }
    : acc;

function populateCollections(obj) {
    const acc = { ...obj };
    const collections = getCollections(obj);

    // TODO: make readable... sorry world, I was rushing
    function walk(value) {
        return typeof value === 'object'
            ? Array.isArray(value)
                ? value.map(v => walk(v))
                : Object.entries(value).reduce((a, [ k, v ]) => {
                    a[k] = (k === 'args')
                        ? v.reduce((aa, arg) => {
                            if (arg.type === 'collection' && collections[arg.name]) return [
                                ...aa,
                                ...walk(collections[arg.name])
                            ];
                            return [
                                ...aa,
                                walk(arg)
                            ];
                          }, [])
                        : walk(v);
                    return a;
                  }, {})
            : value;
    }

    return walk(acc);
}

function prompts(acc, cmdPath, args, config, cmdKey) {
    if (args == null) throw new Error('invalid arguments');

    if (Array.isArray(args)) return [
        ...acc,
        ...args.reduce((a, v) => [
            ...a,
            ...prompts(acc, cmdPath, v, config, cmdKey)
        ], acc)
    ];

    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[args.command] || {};
        const nextArgs = args.args || [];

        return [ ...acc, ...prompts(acc, nextCmdPath, nextArgs, nextConfig, cmdKey) ];
    }

    if (typeof args === 'string') args = { name: args };

    if (config[args.name] == null && args.required) {
        const name = `${cmdKey}.${args.name}`;

        return [ ...acc, {
            name,
            type: 'input',
            message: name
        } ];
    }

    return acc;
}

function concatAdjacentFlags(args) {

    return args.reduce((acc, arg, i) => {

        if (arg.type === 'flag') {
            if (arg.useValue) throw new Error(`Invalid use of \`useValue\` on concatted flag \`${arg.name}\``);

            let prev = args[i - 1];
            if (prev && prev.type === 'flag') {
                prev.name += arg.name;
                return acc;
            }
        }

        acc = [ ...acc, arg ];

        return acc;
    }, []);
}

function concatGivenFlags(args, givenFlags) {

    let insertionPoint = 1;
    const [ before, flags, after ] = (args || []).reduce(([ b, f, a ], v, i) => {
        if (v.type === 'flag' && (!Array.isArray(givenFlags) || givenFlags.includes(v.name))) {
            if (v.useValue) throw new Error(`Invalid use of \`useValue\` on concatted flag \`${v.name}\``);
            if (!f) {
                insertionPoint = i;
                f = v;
            } else {
                f.name += v.name;
            }
            return [ b, f, a ];
        }
        return i < insertionPoint
            ? [ [ ...b, v ], f, a ]
            : [ b, f, [ ...a, v ] ];
    }, [ [], null, [] ]);

    return flags
        ? [ ...before, flags, ...after ]
        : [ ...before, ...after ];
}

function tokenize(token, cmdPath, config) {
    if (token == null) throw new Error('invalid arguments');

    if (Array.isArray(token)) return token.reduce((a, t) => [
        ...a,
        ...tokenize(t, cmdPath, config)
    ], []);

    if (token.command && cmdPath[0] === token.command) {
        if (typeof token.command !== 'string') throw new Error('Invalid Spec: command must be a string');

        const nextToken = token.args || [];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[token.command] || {};
        const nextConcatFlags = token.concatFlags;

        const nextTokens = tokenize(nextToken, nextCmdPath, nextConfig)
        const nextCmdIdx = nextTokens.findIndex(t => t.command);

        let ownTokens = nextCmdIdx == -1
            ? nextTokens
            : nextTokens.slice(0, nextCmdIdx);

        const restTokens = nextCmdIdx == -1
            ? []
            : nextTokens.slice(nextCmdIdx);

        if (nextConcatFlags === 'adjacent') ownTokens = concatAdjacentFlags(ownTokens);
        if (nextConcatFlags === true || Array.isArray(nextConcatFlags)) ownTokens = concatGivenFlags(ownTokens, nextConcatFlags);

        return [
            {
                name: token.command,
                type: 'value',
                command: true,
                value: token.command
            },
            ...ownTokens,
            ...restTokens
        ];
    }

    if (typeof token === 'string') token = { name: token };

    if (config[token.name] == null && token.default) config[token.name] = token.default;

    if (config[token.name] || [ 'variable' ].includes(token.type)) {
        if (token.type == null) token.type = 'option';
        if (typeof token.value === 'string' && token.value.includes('${')) {
            let ctx = mapKeys(config, (v, k) => snakeCase(k));
            token.value = Array.isArray(token.value)
                    ? token.value.map(v => evaluate(`\`${v}\``, ctx))
                    : evaluate(`\`${token.value}\``, ctx);
        } else {
            token.value = config[token.name] != null
                ? Array.isArray(config[token.name])
                    ? config[token.name].map(String)
                    : String(config[token.name])
                : null;
        }
        if (token.type === 'variable') {
            config[token.name] = token.value;
        } else {
            return [ token ];
        }
    }

    return [];
}

function parseArgv(tokens) {
    return tokens.reduce((argv, arg) => {

        let {
            name,
            type = 'option',
            value,
            join = false,
            useValue,
            with:w,
            without:wo
        } = arg;

        if (join) {
            join = typeof join === 'string'
                ? join
                : '=';
        }

        if (w) {
            w = Array.isArray(w)
                ? w
                : [ w ];
            if (!tokens.find(v => w.includes(v.name))) {
                throw new Error(`the ${type} \`${name}\` must be accompanied by \`${w.join('\`, `')}\``);
            }
        }

        if (wo) {
            wo = Array.isArray(wo)
                ? wo
                : [ wo ];
            const bad = tokens.find(v => wo.includes(v.name));
            if (bad) {
                throw new Error(`the ${type} \`${name}\` and the ${bad.type} \`${bad.name}\` cannot be used together`);
            }
        }

        let result;

        switch (type) {
            case 'value':
                result = value;
                break;
            case 'values':
                result = value;
                break;
            case 'option':
                result = `--${name}`;
                if (useValue === false) break;
                result = [ result, value ];
                if (join) result = result.join(join);
                break;
            case 'flag':
                result = `-${name}`;
                if (useValue === true) {
                    result = [ result, value ];
                    if (join) result.join(join);
                } else if (join) {
                    result = [ result, 'true' ].join(join);
                }
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        return (result != null)
            ? [ ...argv, ...(Array.isArray(result) ? result : [ result ]) ]
            : argv;
    }, []);
}

function getCmdPath(main, cmd) {
    return cmd
        ? [ main, ...(Array.isArray(cmd) ? cmd : (cmd || '').split('.')) ]
        : [ main ];
}

function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec, label, alias, config:boundConfig = {}, silent } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');
    if (!spec.command) throw new Error('invalid spec - missing main command definition');

    spec = populateCollections(spec);
    const main = spec.command;

    function getTokens(config = {}, cmdPath = []) {
        let tokens = tokenize(spec, cmdPath, config);
        return tokens;
    }

    function getPrompts(config = {}, cmd = '') {
        cmd = getCmdPath(main, cmd);
        return prompts([], cmd, spec, { [main]: config }, cmd.join('.'));
    }

    function getArgv(config = {}, cmd = '') {
        cmd = getCmdPath(main, cmd);
        const tokens = getTokens({ [main]: config }, cmd);
        const argv = parseArgv(tokens);
        return argv;
    }

    async function promptedArgv(config = {}, cmd = '') {
        const prompts = getPrompts(config, cmd);
        const answers = (await inquirer.prompt(prompts))[main] || {};
        return await getArgv(merge(config, answers), cmd);
    }

    function spawn(config = {}, cmd = '', spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = getArgv(config, cmd);
        return child_process.spawn(command, args, spawnOptions);
    }

    async function promptedSpawn(config = {}, cmd = '', spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = await promptedArgv(config, cmd);
        return child_process.spawn(command, args, spawnOptions);
    }

    return {
        getPrompts,
        getArgv,
        promptedArgv,
        spawn,
        promptedSpawn
    };
}
