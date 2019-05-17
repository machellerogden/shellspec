# ShellSpec

> Shell command specification and JavaScript reference implementation

# Descriptor Syntax

TypeScript is used below to describe the specification. TypeScript is prefered over something like EBNF in hopes that it will be more approachable. Please note ShellSpec has nothing to do with TypeScript. Even the reference implementation (contained in this repo) does not use TypeScript. It appears here to act as a descriptor syntax.

# Specification

The intention of ShellSpec is that any shell command can be specified by implementing the `Definition` interface below.

```ts
interface Definition {
    kind: 'shell';
    spec: Command;
}

interface Command {
    command: string;
    collections?: {
        [key: string]: Args
    };
    concatFlags?: string[] | boolean;
    args: Args;
}

interface Args {
    // when value is `string`, implementation should treat as `Arg` with `name` set to value and `type` set to 'option'`
    [index: number]: Command | Arg | string;
}

interface Arg {
    name: string;

    // when `type` is not provided, implementation is expected to default to 'option'
    type?: 'option' | 'flag' | 'value' | 'values' | 'variable' | 'collection';

    value?: any;
    default?: any;
    with?: string[] | string;
    without?: string[] | string;
    required?: boolean;

    // defaults to `true` for Arg of `type` = "option" and to `false` for Arg of `type` = "flag"
    useValue?: boolean;

    // joins name and value with given string. When `true` name and value will be joined with `=`.
    join?: string | boolean;
}
```

# Reference Implementation

In order to demostrate the viability and make ShellSpec useful, this repo contains a reference implementation.

## Install

```sh
npm i shellspec
```

## Usage

The ShellSpec module exports a factory function.

For example, here spec for the `echo` shell command is declared and an `echo` instance is created.

```js
const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    spec: {
        command: 'echo',
        args: [
            {
                name: 'args',
                type: 'values'
            }
        ]
    }
}

const echo = ShellSpec(spec);
```

When called with a spec definition, the ShellSpec factory returns an object containing several methods for contructing or executing shell commands based on the given spec.

There methods are:

   *  `getArgv`
   *  `promptedArgv`
   *  `spawn`
   *  `promptedSpawn`

Let's take a look at the above methods, one at a time.

### `getArgv`

The `getArgv` method, when called with valid config, will use the values of the config to return an argv array which can then be passed to an exector of your choosing.

```js
echo.getArgv({ args: [ 'hello', 'world' ] });

// => [ 'echo', 'hello', 'world' ]

echo.getArgv({ args: [ 'hi', 'mom' ] });

// => [ 'echo', 'hi', 'mom' ]
````

## `aws`

Here's a small piece of what could become a full AWS CLI spec. This demostrates how to define and work with subcommands.


```js

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    spec: {
        command: 'aws',
        args: [
            {
                name: 'debug',
                type: 'option'
            },
            {
                name: 'endpoint-url',
                type: 'option'
            },
            {
                command: 's3',
                args: [
                    {
                        command: 'cp',
                        args: [
                            {
                                name: 'src',
                                type: 'option'
                            },
                            {
                                name: 'dest',
                                type: 'option'
                            }
                        ]
                    }
                ]
            }
        ]
    }
};

const aws = ShellSpec(spec);

aws.getArgv({
    debug: true,
    s3: {
        cp: {
            src: './foo',
            dest: './bar'
        }
    }
}, 's3.cp');

// => [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];
```

## `docker`

This partial docker spec shows one way you can used named collections as well as variable arguments and EL-style templating.

```js

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    spec: {
        command: 'docker',
        collections: {
            tag: [
                {
                    name: 'registry',
                    type: 'variable'
                },
                {
                    name: 'name',
                    type: 'variable',
                    required: true
                },
                {
                    name: 'version',
                    type: 'variable',
                    default: 'latest'
                },
                {
                    name: 'tag',
                    type: 'variable',
                    value: '${registry ? `${registry}/` : ""}${name}:${version}'
                }
            ]
        },
        args: [
            {
                command: 'build',
                args: [
                    {
                        name: 'tag',
                        type: 'collection'
                    },
                    {
                        name: 'tag',
                        type: 'option',
                        value: '${tag}'
                    },
                    {
                        name: 'context',
                        type: 'value',
                        default: '.'
                    }
                ]
            },
            {
                command: 'run',
                args: [
                    {
                        name: 'interactive',
                        type: 'option',
                        useValue: false
                    },
                    {
                        name: 'tty',
                        type: 'option',
                        useValue: false
                    },
                    {
                        name: 'tag',
                        type: 'collection'
                    },
                    {
                        name: 'tag',
                        type: 'value',
                        value: '${tag}'
                    },
                    {
                        "name": 'command',
                        "type": 'value'
                    }
                ]
            },
            {
                command: 'push',
                args: [
                    {
                        name: 'tag',
                        type: 'collection'
                    }
                ]
            }
        ]
    }
};

const docker = ShellSpec(spec);

docker.getArgv({
    build: {
        name: 'foo',
        version: 'latest',
        context: '.'
    }
}, 'build');

// => [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

docker.getArgv({
    run: {
        name: 'foo',
        version: 'latest',
        command: 'sh'
    }
}, 'run');

// => [ 'docker', 'run', 'foo:latest', 'sh' ];

```

# License

MIT
