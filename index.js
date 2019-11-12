'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const clone = require('lodash/cloneDeep');
const get = require('lodash/get');
const inquirer = require('inquirer');
const { merge } = require('sugarmerge');
const evaluate = require('./evaluate');
const child_process = require('child_process');
const definitionSchema = require('./schema');

function ShellSpec(spec, cmdVersion = 'default') {
    const {
        error,
        value
    } = definitionSchema.validate(spec);

    if (error) throw new Error(error);

    const {
        main,
        collections,
        versions,
        commands,
        args = []

    } = spec;

    const cmdDef = versions
        ? resolveVersion(versions, cmdVersion)
        : { commands, args };

    const cmdSpec = {
        commands: {
            // NB, may need deep clone on value... need tests
            [main]: populateCollections(cmdDef, collections)
        }
    };

    function getConfigPaths(cmd = [], pathPrefix) {
        const cmdPath = normalizePath(cmd);
        return listArgs({ cmdDef: cmdSpec.commands[main], cmdPath, pathPrefix })
            .map(({ path }) => path);
    }

    function getRequiredConfigPaths(cmd = [], pathPrefix) {
        const cmdPath = normalizePath(cmd);
        return listArgs({ cmdDef: cmdSpec.commands[main], cmdPath, pathPrefix })
            .filter(({ required }) => required)
            .map(({ path }) => path);
    }

    function getPrompts(config = {}, cmd = []) {
        const cmdPath = [ main, ...normalizePath(cmd) ];
        return prompts(cmdPath, cmdSpec, { [main]: config });
    }

    function getArgv(config = {}, cmd = []) {
        const cmdPath = [ main, ...normalizePath(cmd) ];
        const rawTokens = tokenize(cmdPath, clone(cmdSpec), { [main]: config });
        const validTokens = validate(rawTokens);
        const concattedTokens = concat(validTokens);
        const argv = emit(concattedTokens);
        return argv;
    }

    async function promptedArgv(config = {}, cmd = []) {
        const prompts = getPrompts(config, cmd);
        const answers = (await inquirer.prompt(prompts))[main] || {};
        return await getArgv(merge(config, answers), cmd);
    }

    function spawn(config = {}, cmd, spawnOptions = { stdio: 'inherit' }) {
        cmd = cmd || [];
        const [ command, ...args ] = getArgv(config, cmd);
        return child_process.spawn(command, args, spawnOptions);
    }

    async function promptedSpawn(cmd = [], config = {}, spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = await promptedArgv(cmd, config);
        return child_process.spawn(command, args, spawnOptions);
    }

    return {
        getConfigPaths,
        getRequiredConfigPaths,
        getPrompts,
        getArgv,
        promptedArgv,
        spawn,
        promptedSpawn
    };
}

const primitives = new Set([ 'string', 'number', 'boolean' ]);

function concat(tokens) {
    return tokens.reduce((argv, arg, i) => {
        if (argv.length > 0) {
            const prev = argv[argv.length - 1];
            if (arg.concatable && arg.type === 'flag' && !prev.useValue && prev.concatable) {
                prev.name = Array.isArray(prev.name)
                    ? [ ...prev.name, arg.name ]
                    : [ prev.name, arg.name ];
                prev.key += arg.key;
                prev.value = arg.value;
                prev.useValue = arg.useValue;
                return argv;
            }
        }
        return [ ...argv, arg ];
    }, []);
}

function resolveVersion(versions, ver) {
    if (typeof ver === 'object') return ver;
    const version = versions[ver] || versions['default'];
    if (typeof version == 'string') return resolveVersion(versions, version);
    // TODO:
    // Either tighten up recursion exit clause or tighten up the schema
    // validation to prevent circular references... it's only a matter of time
    // until this code pegs some unsuspecting CPU.
    return version;
}

function tokenize(cmdPath, spec, config) {
    if (spec == null || typeof spec != 'object' || Array.isArray(spec)) throw new Error('invalid spec');

    let result = [
        ...(spec.args || []).reduce((acc, arg) => {
            if (typeof arg === 'string') arg = { name: arg };

            if (isMissingRequiredConfig(arg, config)) throw new Error(`missing required config for \`${arg.name}\``);

            arg.key = arg.key == null
                ? arg.name
                : arg.key;

            if (config[arg.name] == null && arg.default) config[arg.name] = arg.default;

            if (config[arg.name] != null || [ 'variable' ].includes(arg.type)) {
                arg = standardizeToken(arg);
                if (isTemplated(arg.value)) {
                    // TODO:
                    // Find a workaround for case transform below. Introduces
                    // non-determinism via the possibility of name collisions.
                    // Easy fix is to force use a context object when user is
                    // writing template strings. i.e. Use `ctx["arg-name"]` in
                    // templates instead of `argName`. API becomes a bit uglier,
                    // but completely side-steps the possibility of collisions.
                    //
                    // Alternatively, we could parse template string ahead of
                    // evaluation and apply case change at compile time. API
                    // improves but it but doesn't actually solve the essential
                    // problem and collisions are still possible.
                    //
                    // For now, the impetus is on the spec author to define
                    // names which won't collide when normalized to snake case.
                    const ctx = mapKeys(config, (v, k) => snakeCase(k));
                    arg.value = Array.isArray(arg.value)
                            ? arg.value.map(v => evaluate(`\`${v}\``, ctx))
                            : evaluate(`\`${arg.value}\``, ctx);
                } else {
                    arg.value = arg.value
                        || (config[arg.name] != null
                            ? config[arg.name]
                            : null);
                }
                if (arg.type === 'variable') {
                    config[arg.name] = arg.value;
                } else {
                    return [ ...acc, arg ];
                }
            }
            return acc;
        }, [])
    ];

    if (spec.commands && cmdPath.length) {
        if (spec.commands[cmdPath[0]] == null) throw new Error(`Command \`${cmdPath[0]}\` not found.`);
        const nextCmdName = cmdPath[0];
        const nextCmd = spec.commands[nextCmdName];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[nextCmdName] || {};
        const nextTokens = tokenize(nextCmdPath, nextCmd, nextConfig);
        result = [
            ...result,
            {
                name: nextCmdName,
                type: 'value',
                command: true,
                value: nextCmdName
            },
            ...nextTokens
        ];
    }

    return result;
}

function validate(tokens) {
    return tokens.reduce((argv, arg) => {
        let {
            name,
            type = 'option',
            choices,
            value
        } = arg;

        if (arg.with) {
            const result = findInSet(arg.with, tokens, type, name);
            if (result == null) throw new Error(`the ${type} \`${name}\` must be accompanied by \`${Array.isArray(arg.with) ? arg.with.join('\`, `') : arg.with}\``);
        }

        if (arg.withAll) {
            const result = findAllInSet(arg.withAll, tokens, type, name);
            if (!result) throw new Error(`the ${type} \`${name}\` must be accompanied by all of the following: \`${Array.isArray(arg.withAll) ? arg.withAll.join('\`, `') : arg.withAll}\``);
        }

        if (arg.without || arg.aka) {
            const result = findInSet(arg.without || arg.aka, tokens, type, name);
            if (result != null) throw new Error(`the ${type} \`${name}\` and the ${result.type} \`${result.name}\` cannot be used together`);
        }

        if (arg.when) {
            const result = findInSet(arg.when, tokens, type, name);
            if (result == null) return argv;
        }

        if (arg.whenAll) {
            const result = findAllInSet(arg.whenAll, tokens, type, name);
            if (!result) return argv;
        }

        if (arg.unless) {
            const result = findInSet(arg.unless, tokens, type, name);
            if (result != null) return argv;
        }

        if (choices != null) validateChoice(choices, value, name, type);

        return [ ...argv, arg ];
    }, []);
}

function emit(tokens) {
    return tokens.reduce((argv, arg) => {

        let {
            key,
            type = 'option',
            value,
            join:delimiter,
            useValue,
            prefix
        } = arg;

        if (delimiter != null) {
            delimiter = typeof delimiter === 'string'
                ? delimiter
                : '=';
        }

        let result;

        switch (type) {
            case 'value':
            case 'values':
                result = value;
                break;
            case 'option':
            case 'flag':
                result = kvJoin(prefix, key, value, type, delimiter, useValue);
                break;
            case '--':
                result = [
                    '--',
                    ...(Array.isArray(value)
                        ? value
                        : [ value ])
                ];
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        return (result != null)
            ? [
                ...argv,
                ...(Array.isArray(result) ? result.map(String) : [ String(result) ])
              ]
            : argv;
    }, []);
}

function isMissingRequiredConfig(token, config) {
    return token.required
        && !(config[token.name] != null
            || (token.aka
                ? Array.isArray(token.aka)
                    ? token.aka.some(n => config[n] != null)
                    : config[token.aka] != null
                : false));
}

// TODO: lots of duplicate code between this and the tokenize function. Should probably find a way to dry it up...
function prompts(cmdPath, spec, config, cmdKey) {
    if (spec == null || typeof spec != 'object' || Array.isArray(spec)) throw new Error('invalid spec');

    const currentCmdKey = cmdKey == null
        ? cmdPath[0]
        : cmdKey;

    let result = [
        ...(spec.args || []).reduce((acc, arg) => {
            if (typeof arg === 'string') arg = { name: arg };

            if (isMissingRequiredConfig(arg, config)) {
                const name = `${currentCmdKey}.${arg.name}`;
                const message = arg.message || name;
                const prompt = {
                    name,
                    message,
                    type: 'input',
                    when: answers => isMissingRequiredConfig(arg, merge(config, get(answers, currentCmdKey, {})))
                };
                if (arg.choices) {
                    prompt.type = 'list';
                    prompt.choices = arg.choices;
                }
                return [ ...acc, prompt ];
            }
            return acc;
        }, [])
    ];

    if (spec.commands && cmdPath.length) {
        if (spec.commands[cmdPath[0]] == null) throw new Error(`Command \`${cmdPath[0]}\` not found.`);
        const nextCmdName = cmdPath[0];
        const nextCmd = spec.commands[nextCmdName];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[nextCmdName] || {};
        const nextCmdKey = typeof cmdKey === 'string'
            ? `${cmdKey}.${nextCmdName}`
            : nextCmdName;
        const nextPrompts = prompts(nextCmdPath, nextCmd, nextConfig, nextCmdKey);
        result = [
            ...result,
            ...nextPrompts
        ];
    }

    return result;
}

function isTemplated (value) {
    return (typeof value === 'string' && value.includes('${'))
        || (Array.isArray(value) && value.reduce((acc, v) => acc || v.includes('${'), false));
}

function standardizeToken(token) {
    if (token.type == null) token.type = 'option';
    if ([ 'option', 'flag' ].includes(token.type)) {
        if (token.type === 'option') token.prefix = '--';
        if (token.type === 'flag') token.prefix = '-';
        if (token.useValue == null) {
            if (token.type == 'option') token.useValue = true;
            if (token.type == 'flag') token.useValue = false;
        }
    }
    return token;
}

function kvJoin(prefix, key, value, type, delimiter, useValue) {
    key = `${prefix}${key}`;
    if (typeof useValue === 'string') useValue = primitives.has(useValue)
        ? typeof value === useValue
        : value == useValue;
    if (Array.isArray(useValue)) useValue = useValue.reduce((a, uv) =>
        a ||
        primitives.has(uv)
            ? typeof value === uv
            : value == uv,
        false);
    return useValue === false
        ? Array.isArray(value)
            ? value.fill(key)
            : key
        : Array.isArray(value)
            ? delimiter != null
                ? value.reduce((acc, v) => [
                    ...acc,
                    ...[ key, v ].join(delimiter)
                  ], [])
                : value.reduce((acc, v) => [
                    ...acc,
                    key,
                    v
                  ], [])
            : delimiter != null
                ? [ key, value ].join(delimiter)
                : [ key, value ];
}

function normalizePath(cmd) {
    return [
        ...(Array.isArray(cmd)
            ? cmd
            : (cmd || '').split('.'))
    ];
}

function resolveFromPath(spec, cmdPath) {
    if (!cmdPath.length) return spec;
    const [ nextCmd, ...rest ] = cmdPath;
    if (spec.commands && spec.commands[nextCmd]) return resolveFromPath(spec.commands[nextCmd], rest);
    throw new Error('no');
}

const addPaths = (collections, args) =>
    (args || [])
        .map(arg =>
            typeof arg === 'string'   ? { path: arg }
          : arg.type === 'collection' ? addPaths(collections, collections[arg.name])
                                      : { ...arg, path: arg.name })
        .flat(Infinity);

// TODO, maybe:
// Still looking for good ways to dry up the commonalities of the `tokenize`
// and the `prompts` functions. `listArgs` has a pretty simple approach which
// might help. Probably worth further consideration...
function listArgs({
    cmdDef,
    cmdPath,
    pathPrefix = [],
    asString = true
}) {
    const prefix = Array.isArray(pathPrefix)        ? pathPrefix
                 : (typeof pathPrefix === 'string') ? [ pathPrefix ]
                                                    : [];
    const resolvedDef = resolveFromPath(cmdDef, cmdPath);
    if (resolvedDef == null || typeof resolvedDef != 'object') throw new Error('something went wrong');
    function recur(s) {
        const argPaths = addPaths(cmdDef.collections || [], s.args || []);
        return [
            ...argPaths,
            ...Object.entries(s.commands || {}).reduce((acc, [ k, v ]) => {
                const sub = v.commands || v.args
                    ? recur(v).map(arg => {
                        arg.path = asString
                            ? [ k, arg.path ].join('.')
                            : [ k, arg.path ];
                        return arg;
                    })
                    : [];
                return [ ...acc, ...sub ];
            }, [])
        ];
    }
    return recur(resolvedDef).map((arg) => {
        const p = [ ...pathPrefix, ...cmdPath, arg.path ];
        arg.path = asString
            ? p.join('.')
            : p;
        return arg;
    });
}

function findInSet(testSet, tokens, type, name) {
    testSet = Array.isArray(testSet)
        ? testSet
        : [ testSet ];
    return tokens.find(v => testSet.includes(v.name));
}

function findAllInSet(testSet, tokens, type, name) {
    testSet = Array.isArray(testSet)
        ? testSet
        : [ testSet ];
    let i = 0;
    const names = new Set(tokens.map(({ name }) => name));
    const result = testSet.reduce((a, v) => a && names.has(v), true)
    return result;
}

function validateChoice(choices, value, name, type) {
    // TODO: need to find a way to support use-case where there are a set of
    // choices, but also support for arbitrary values, such as `npm version`
    // where the primary choices are `patch`, `minor`, `major` and we want to
    // support a menu prompt for these but any valid semver value can also be
    // provided. this is not supported yet but needs to be.
    if (primitives.has(choices)) choices = [ choices ];
    if (Array.isArray(value)
        ? value.reduce((a, v) => a && !choices.includes(v), true)
        : !choices.includes(value)) {
        throw new Error(`the ${type} \`${name}\` has invalid value of "${value}". Valid values are: ${choices.map(v => `"${v}"`).join(', ')}`);
    }
}

function populateCollections(spec, collections) {
    // Here's a description of what's happening:
    //
    // 1. We pull out all "collections" from the spec merging them all into a
    //    single map. Note: spec must be properly defined to ensure globally
    //    unique collection names.
    // 2. We then take a depth first walk through the spec looking for all args
    //    where a type === "collection" and replace each occurence with a spread
    //    value from the collections map with key === name.
    const acc = { ...spec };

    function walk(value) {
        return typeof value !== 'object'  ? value
            : Array.isArray(value)        ? value.map(v => walk(v))
            : /* default */                 Object.entries(value).reduce((a, [ k, v ]) => {
                                                a[k] = k !== 'args'
                                                    ? walk(v)
                                                    : v.reduce((aa, arg) => arg.type === 'collection' && collections[arg.name]
                                                        ? [ ...aa, ...walk(collections[arg.name]) ]
                                                        : [ ...aa, walk(arg) ], []);
                                               return a;
                                            }, {})
    }

    return walk(acc);
}
