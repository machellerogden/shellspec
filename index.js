'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const cloneDeep = require('lodash/cloneDeep');
const inquirer = require('inquirer');
const { merge } = require('sugarmerge');
const evaluate = require('./evaluate');
const child_process = require('child_process');

const getByKeyDeep = (obj, key, acc = {}) => typeof obj === 'object'
    ? Array.isArray(obj)
        ? {
            ...acc,
            ...obj.reduce((a, v) =>
                getByKeyDeep(v, key, a),
                {})
          }
        : {
            ...acc,
            ...Object.entries(obj).reduce((a, [ k, v ]) =>
                k === key
                    ? { ...a, ...v }
                    : getByKeyDeep(v, key, a),
                {})
          }
    : acc;

function populateCollections(obj) {
    const acc = { ...obj };
    const collections = getByKeyDeep(obj, 'collections');

    // TODO:
    // make this actually readable and break it into generic pieces.
    // it probably should just use a simple visitor pattern.
    // sorry world, I was rushing.
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

function prompts(cmdPath, args, config, cmdKey) {
    if (args == null) throw new Error('invalid arguments');

    if (Array.isArray(args)) return args.reduce((a, v) => [
        ...a,
        ...prompts(cmdPath, v, config, cmdKey)
    ], []);

    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[args.command] || {};
        const nextArgs = args.args || [];

        return [
            ...prompts(nextCmdPath, nextArgs, nextConfig, cmdKey)
        ];
    }

    if (typeof args === 'string') args = { name: args };

    if (config[args.name] == null && args.required) {
        const name = `${cmdKey}.${args.name}`;
        const message = args.message || name;
        const prompt = {
            name,
            message,
            type: 'input',
            filter: v => v.split(' ').reduce((a, b, i, c) => {
                if (i < c.length) {
                    if (b.endsWith('\\')) {
                        b = [ b.slice(0, -1),  c[i + 1] ].join(' ');
                        c.splice(i + 1, 1);
                    }
                }
                a = [ ...a, b ];
                return a;
            }, [])
        };
        if (args.choices) {
            prompt.type = 'list';
            prompt.choices = args.choices;
        }
        return [ prompt ];
    }

    return [];
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
const isTemplated = value =>
    (typeof value === 'string' && value.includes('${'))
    || (Array.isArray(value) && value.reduce((acc, v) => acc || v.includes('${'), false));

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

    if (config[token.name] != null || [ 'variable' ].includes(token.type)) {
        if (token.type == null) token.type = 'option';
        if (isTemplated(token.value)) {
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

function kvJoin(key, value, type, delimiter, useValue) {
    return useValue === false
        ? Array.isArray(value)
            ? value.fill(key)
            : key
        : Array.isArray(value)
            ? delimiter
                ? value.reduce((acc, v) => [
                    ...acc,
                    ...[ key, v ].join(delimiter)
                  ], [])
                : value.reduce((acc, v) => [
                    ...acc,
                    key,
                    v
                  ], [])
            : delimiter
                ? [ key, value ].join(delimiter)
                : [ key, value ];
}

function validateValue(choices, value, name, type) {
    if (Array.isArray(value)
        ? value.reduce((a, v) => a && !choices.includes(v), true)
        : !choices.includes(value)) {
        throw new Error(`the ${type} \`${name}\` has invalid value of "${value}". Valid values are: ${choices.map(v => `"${v}"`).join(', ')}`);
    }
}

function validateContext(testSet, tokens, type, name, toggle) {
    testSet = Array.isArray(testSet)
        ? testSet
        : [ testSet ];
    const result = tokens.find(v => testSet.includes(v.name));
    if (toggle && !result) {
        throw new Error(`the ${type} \`${name}\` must be accompanied by \`${testSet.join('\`, `')}\``);
    } else if (!toggle && result) {
        throw new Error(`the ${type} \`${name}\` and the ${result.type} \`${result.name}\` cannot be used together`);
    }
}

function parseArgv(tokens) {
    return tokens.reduce((argv, arg) => {

        let {
            name,
            type = 'option',
            value,
            join:delimiter = false,
            useValue,
            with:w,
            without:wo,
            choices
        } = arg;

        if (delimiter) {
            delimiter = typeof delimiter === 'string'
                ? delimiter
                : '=';
        }

        if (Array.isArray(choices)) validateValue(choices, value, name, type);

        if (w) validateContext(w, tokens, type, name, true);

        if (wo) validateContext(wo, tokens, type, name);

        let result;

        switch (type) {
            case 'value':
            case 'values':
                result = value;
                break;
            case '--':
                result = Array.isArray(value)
                    ? [ '--', ...value ]
                    : [ '--', value ];
                break;
            case 'option':
                result = kvJoin(`--${name}`, value, type, delimiter, useValue == null ? true : false);
                break;
            case 'flag':
                result = kvJoin(`-${name}`, value, type, delimiter, useValue == null ? false : true);
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        return (result != null)
            ? [
                ...argv,
                ...(Array.isArray(result) ? result : [ result ])
              ]
            : argv;
    }, []);
}

function getCmdPath(main, cmd) {
    return cmd
        ? [
            main,
            ...(Array.isArray(cmd)
                ? cmd
                : (cmd || '').split('.'))
          ]
        : [ main ];
}

function listConfig(spec, prefix) {
    if (spec == null || typeof spec != 'object') throw new Error('something went wrong');
    return Array.isArray(spec)
        ? spec.reduce((acc, arg) => {
            if (arg.command) {
                acc = [ ...acc, ...listConfig(arg.args || [], prefix ? `${prefix}.${arg.command}` : arg.command) ];
            } else if (arg.name) {
                acc = [ ...acc, prefix ? `${prefix}.${arg.name}` : arg.name ];
            }
            return acc;
        }, [])
        : spec.command && [ ...listConfig(spec.args || []) ];
}

function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    let {
        spec,
        label,
        alias,
        config:boundConfig = {},
        silent
    } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');
    if (!spec.command) throw new Error('invalid spec - missing main command definition');

    spec = populateCollections(spec);
    const main = spec.command;

    function getConfigPaths() {
        return listConfig(spec);
    }

    function getTokens(config = {}, cmdPath = []) {
        let tokens = tokenize(spec, cmdPath, config);
        return tokens;
    }

    function getPrompts(config = {}, cmd = '') {
        cmd = getCmdPath(main, cmd);
        return prompts(cmd, spec, { [main]: config }, cmd.join('.'));
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
        getConfigPaths,
        getPrompts,
        getArgv,
        promptedArgv,
        spawn,
        promptedSpawn
    };
}
