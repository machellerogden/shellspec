import test from 'ava';
import ShellSpec from '..';

import aws from './mocks/aws';
import docker from './mocks/docker';
import git from './mocks/git';

test('aws 1', async t => {

    const { getArgv } = await ShellSpec(aws);

    const config = {
        aws: {
            debug: true,
            s3: {
                cp: {
                    src: './foo',
                    dest: './bar'
                }
            }
        }
    };

    const argv = getArgv('aws.s3.cp', config, );

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    t.deepEqual(argv, output);
});

test('aws 2', async t => {

    const { getArgv } = await ShellSpec(aws);

    const config = {
        aws: {
            debug: true,
            s3: {
                cp: {
                    src: './foo'
                }
            }
        }
    };

    const argv = getArgv('aws.s3.cp', config);

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo' ];

    t.deepEqual(argv, output);
});

test('docker build', async t => {

    const { getArgv } = await ShellSpec(docker);

    const config = {
        docker: {
            build: {
                name: 'foo',
                version: 'latest',
                context: '.'
            }
        }
    };

    const argv = getArgv('docker.build', config);

    const output = [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

    t.deepEqual(argv, output);
});

test('docker run', async t => {

    const { getArgv } = await ShellSpec(docker);

    const config = {
        docker: {
            run: {
                name: 'foo',
                version: 'latest',
                command: 'sh'
            }
        }
    };

    const argv = getArgv('docker.run', config);

    const output = [ 'docker', 'run', 'foo:latest', 'sh' ];

    t.deepEqual(argv, output);
});

test.only('git rev-parse defaults', async t => {

    const { getArgv } = await ShellSpec(git);

    const config = {};

    const argv = getArgv('git.rev-parse', config);

    const output = [ 'git', 'rev-parse', '--short=12', 'HEAD' ];

    t.deepEqual(argv, output);
});

test('git rev-parse w options', async t => {

    const { getArgv } = await ShellSpec(git);

    const config = {
        git: {
            "rev-parse": {
                short: 8,
                refspec: "origin/master"
            }
        }
    };

    const argv = getArgv('git.rev-parse', config);

    const output = [ 'git', 'rev-parse', '--short=8', 'origin/master' ];

    t.deepEqual(argv, output);
});

test('simple echo', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            echo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'args',
                                type: 'values'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        echo: {
            args: [ 'foo', 'bar', 123, true, false ]
        }
    };

    const argv = getArgv('echo', config);

    const output = [ 'echo', 'foo', 'bar', '123', 'true', 'false' ];

    t.deepEqual(argv, output);
});

test('with 1', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            formal: true
        }
    };

    const argv = getArgv('greet', config);

    const output = [ 'greet', '--formal', '--first-name', 'Jane', '--last-name', 'Heller-Ogden' ];

    t.deepEqual(argv, output);
});

test('with 2', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            formal: true
        }
    };

    t.throws(() => getArgv('greet', config), 'the option `formal` must be accompanied by `last-name`');
});

test('with 3', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: 'last-name'
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            formal: true
        }
    };

    t.throws(() => getArgv('greet', config), 'the option `formal` must be accompanied by `last-name`');
});

test('with all', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                withAll: [ 'b', 'c', 'd' ]
                            },
                            {
                                name: 'b',
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                type: 'flag'
                            },
                            {
                                name: 'd',
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    t.deepEqual(getArgv('foo', {
        foo: {
            a: true,
            b: true,
            c: true,
            d: true
        }
    }), [ 'foo', '-a', '-b', '-c', '-d' ]);

    t.throws(() => getArgv('foo', {
        foo: {
            a: true,
            b: true,
            d: true
        }
    }), 'the flag `a` must be accompanied by all of the following: `b`, `c`, `d`');
});

test('with all 2', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true,
                                withAll: [ 'b', 'c', 'd' ]
                            },
                            {
                                name: 'b',
                                concatable: true,
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                concatable: true,
                                type: 'flag'
                            },
                            {
                                name: 'd',
                                concatable: true,
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    t.deepEqual(getArgv('foo', {
        foo: {
            a: true,
            b: true,
            c: true,
            d: true
        }
    }), [ 'foo', '-abcd' ]);

    t.throws(() => getArgv('foo', {
        foo: {
            a: true,
            b: true,
            d: true
        }
    }), 'the flag `a` must be accompanied by all of the following: `b`, `c`, `d`');
});

test('without 1', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            casual: true
        }
    };

    const argv = getArgv('greet', config);

    const output = [ 'greet', '--casual', '--first-name', 'Jane' ];

    t.deepEqual(argv, output);
});

test('without 2', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            casual: true
        }
    };

    t.throws(() => getArgv('greet', config), 'the option `casual` and the option `last-name` cannot be used together');
});

test('without 3', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: 'last-name'
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            casual: true
        }
    };

    t.throws(() => getArgv('greet', config), 'the option `casual` and the option `last-name` cannot be used together');
});

test('concat flags', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-abc' ];

    t.deepEqual(argv, output);
});

test('concat flags should only concat adjacent flags so as not to mess with arg order', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'value'
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: 'bar',
            c: true
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-a', 'bar', '-c' ];

    t.deepEqual(argv, output);
});

test('concat flags more tests', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-a', '-b', '-c' ];

    t.deepEqual(argv, output);
});

test('concat flags does the right thing when useValue === true', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: true,
                                concatable: true
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-ab', 'true', '-c' ];

    t.deepEqual(argv, output);
});

test('multiple same option', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            bar: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '--bar', 'a', '--bar', 'b', '--bar', 'c' ];

    t.deepEqual(argv, output);
});

test('multiple same flag', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'b',
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            b: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-b', '-b', '-b' ];

    t.deepEqual(argv, output);
});

test('multiple same flag with value', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    const config = {
        foo: {
            b: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-b', 'a', '-b', 'b', '-b', 'c' ];

    t.deepEqual(argv, output);
});

test('arg can specify valid values as "choices"', async t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option',
                                choices: [
                                    'a',
                                    'b',
                                    'c'
                                ]
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    t.deepEqual(getArgv('foo', { foo: { bar: 'a' } }), [ 'foo', '--bar', 'a' ]);
    t.throws(() => getArgv('foo', { foo: { bar: 'd' } }), 'the option `bar` has invalid value of "d". Valid values are: "a", "b", "c"');
});

test('double dash args', async t => {

    const { getArgv } = await ShellSpec(git);

    const config = {
        git: {
            add: {
                pathspec: [ './src', './dist' ]
            }
        }
    };

    const argv = getArgv('git.add', config);

    const output = [ 'git', 'add', '--', './src', './dist' ];

    t.deepEqual(argv, output);
});

test('useValue only for given type', async t => {
    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option',
                                useValue: 'string'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = await ShellSpec(spec);

    t.deepEqual(getArgv('foo', { foo: { bar: true } }), [ 'foo', '--bar' ]);
    t.deepEqual(getArgv('foo', { foo: { bar: 'baz' } }), [ 'foo', '--bar', 'baz' ]);
});

test('conditional printing', async t => {

    const { getArgv } = await ShellSpec(git);

    t.deepEqual(getArgv('git.branch', {
        git: {
            branch: {
                D: true,
                r: true,
                branchname: 'foo'
            }
        }
    },), [ 'git', 'branch', '-D', '-r', 'foo' ]);

    t.deepEqual(getArgv('git.branch', {
        git: {
            branch: {
                list: true,
                r: true,
                branchname: 'foo'
            }
        }
    }), [ 'git', 'branch', '-r', '--list', 'foo' ]);
});

test('key can be different from name', async t => {

    const { getArgv } = await ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                key: 'baz'
                            }
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getArgv('foo', { foo: { bar: true } }), [ 'foo', '--baz', 'true' ]);
});

test('dynamic useValue does the right thing when join is specified', async t => {

    const { getArgv } = await ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                useValue: 'string',
                                join: '='
                            }
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getArgv('foo', { foo: { bar: true } }), [ 'foo', '--bar' ]);
    t.deepEqual(getArgv('foo', { foo: { bar: 'baz' } }), [ 'foo', '--bar=baz' ]);
    t.deepEqual(getArgv('foo', { foo: { bar: false } }), [ 'foo', '--bar' ]);
});

test('git double dash on clone', async t => {

    const { getArgv } = await ShellSpec(git);

    t.deepEqual(getArgv('git.clone', {
        git: {
            clone: {
                '--': true,
                repository: 'foo'
            }
        }
    }), [ 'git', 'clone', '--', 'foo' ]);
});

test('command not found - main cmd', async t => {
    const { getArgv } = await ShellSpec(git);

    t.throws(() => getArgv('foo', {}), 'Command `foo` not found.');
});

test('command not found - sub cmd', async t => {
    const { getArgv } = await ShellSpec(git);

    t.throws(() => getArgv('git.foo', {}), 'Command `foo` not found.');
});

test('aka', async t => {

    const { getArgv } = await ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                useValue: 'number',
                                join: '=',
                                required: true,
                                aka: [ 'b' ]
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: 'number',
                                required: true,
                                join: '',
                                aka: 'bar'
                            }
                        ]
                    }
                }
            }
        }
    });

    t.throws(() => getArgv('foo', {}), 'missing required config for `bar`');
    t.deepEqual(getArgv('foo', { foo: { bar: 123 } }), [ 'foo', '--bar=123' ]);
    t.deepEqual(getArgv('foo', { foo: { b: 123 } }), [ 'foo', '-b123' ]);
    t.throws(() => getArgv('foo', { foo: { b: true, bar: true } }), 'the option `bar` and the flag `b` cannot be used together');
});

test('getConfigPaths', async t => {
    const { getConfigPaths } = await ShellSpec({
        kind: 'shell',
        commands: {
            a: {
                versions: {
                    default: {
                        commands: {
                            b: {
                                args: [
                                    {
                                        name: 'c',
                                        type: 'flag'
                                    }
                                ],
                                commands: {
                                    d: {
                                        commands: {
                                            e: {
                                                args: [
                                                    {
                                                        name: 'f',
                                                        type: 'flag'
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            },
                            g: {
                                args: [
                                    'h'
                                ]
                            }
                        }
                    }
                }
            }
        }
    });

    t.deepEqual(getConfigPaths(), [
        'a.b.c',
        'a.b.d.e.f',
        'a.g.h'
    ])
});

test('versionless', async t => {
    const {
        getArgv,
        getConfigPaths
    } = await ShellSpec({
        kind: 'shell',
        commands: {
            a: {
                commands: {
                    b: {
                        args: [
                            {
                                name: 'c',
                                type: 'flag'
                            }
                        ],
                        commands: {
                            d: {
                                commands: {
                                    e: {
                                        args: [
                                            {
                                                name: 'f',
                                                type: 'flag'
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    g: {
                        args: [
                            'h'
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getArgv('a.b', { a: { b: { c: true } } }), [
        'a',
        'b',
        '-c'
    ]);

    t.deepEqual(getConfigPaths(), [
        'a.b.c',
        'a.b.d.e.f',
        'a.g.h'
    ])
});

test('getPrompts', async t => {
    const { getPrompts } = await ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                args: [
                    {
                        name: 'bar',
                        required: 'true'
                    }
                ],
                commands: {
                    baz: {
                        args: [
                            {
                                name: 'qux',
                                required: true
                            }
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getPrompts('foo', {
        foo: {
            bar: true,
            baz: {
                qux: true
            }
        }
    }), []);
    const p1 = getPrompts('foo', {
        foo: {}
    });
    t.is(p1[0].name, 'foo.bar');
    t.is(p1[0].message, 'foo.bar');
    t.is(p1[0].type, 'input');
    const p2 = getPrompts('foo.baz', {
        foo: {}
    });
    t.is(p2[0].name, 'foo.bar');
    t.is(p2[0].message, 'foo.bar');
    t.is(p2[0].type, 'input');
    t.is(p2[1].name, 'foo.baz.qux');
    t.is(p2[1].message, 'foo.baz.qux');
    t.is(p2[1].type, 'input');
});
