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
    required?: boolean;
    useValue?: boolean;
    useEquals?: boolean;
}
```

# Reference Implementation

In order to demostrate the viability and make ShellSpec useful, this repo contains a reference implementation. It's usage is best described through examples below.

# Examples

## `echo`

One possible way to spec the `echo` shell command.

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

echo.getArgv({ args: [ 'hello', 'world' ] });

// => [ 'echo', 'hello', 'world' ]
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
                    'add-host',
                    'build-arg',
                    'cache-from',
                    'cgroup-parent',
                    'compress',
                    'cpu-period',
                    'cpu-quota',
                    'cpu-shares',
                    'cpuset-cpus',
                    'cpuset-mems',
                    'disable-content-trust',
                    'force-rm',
                    'iidfile',
                    'isolation',
                    'label',
                    'memory',
                    'memory-swap',
                    'network',
                    'no-cache',
                    'platform',
                    'pull',
                    'quiet',
                    'rm',
                    'security-opt',
                    'shm-size',
                    'squash',
                    'stream',
                    'target',
                    'ulimit',
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
                    'add-host',
                    'attach',
                    'blkio-weight',
                    'blkio-weight-device',
                    'cap-add',
                    'cap-drop',
                    'cgroup-parent',
                    'cidfile',
                    'cpu-count',
                    'cpu-percent',
                    'cpu-period',
                    'cpu-quota',
                    'cpu-rt-period',
                    'cpu-rt-runtime',
                    'cpu-shares',
                    'cpus',
                    'cpuset-cpus',
                    'cpuset-mems',
                    'detach',
                    'detach-keys',
                    'device',
                    'device-cgroup-rule',
                    'device-read-bps',
                    'device-read-iops',
                    'device-write-bps',
                    'device-write-iops',
                    'disable-content-trust',
                    'dns',
                    'dns-opt',
                    'dns-option',
                    'dns-search',
                    'entrypoint',
                    'env',
                    'env-file',
                    'expose',
                    'group-add',
                    'health-cmd',
                    'health-interval',
                    'health-retries',
                    'health-start-period',
                    'health-timeout',
                    'help',
                    'hostname',
                    'init',
                    {
                        name: 'interactive',
                        type: 'option',
                        useValue: false
                    },
                    'io-maxbandwidth',
                    'io-maxiops',
                    'ip',
                    'ip6',
                    'ipc',
                    'isolation',
                    'kernel-memory',
                    'label',
                    'label-file',
                    'link',
                    'link-local-ip',
                    'log-driver',
                    'log-opt',
                    'mac-address',
                    'memory',
                    'memory-reservation',
                    'memory-swap',
                    'memory-swappiness',
                    'mount',
                    'container-name',
                    'net',
                    'net-alias',
                    'network',
                    'network-alias',
                    'no-healthcheck',
                    'oom-kill-disable',
                    'oom-score-adj',
                    'pid',
                    'pids-limit',
                    'platform',
                    'privileged',
                    'publish',
                    'publish-all',
                    'read-only',
                    'restart',
                    'rm',
                    'runtime',
                    'security-opt',
                    'shm-size',
                    'sig-proxy',
                    'stop-signal',
                    'stop-timeout',
                    'storage-opt',
                    'sysctl',
                    'tmpfs',
                    {
                        name: 'tty',
                        type: 'option',
                        useValue: false
                    },
                    'ulimit',
                    'user',
                    'userns',
                    'uts',
                    'volume',
                    'volume-driver',
                    'volumes-from',
                    'workdir',
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
                        name: 'disable-content-trust',
                        type: 'option',
                        default: true
                    },
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
