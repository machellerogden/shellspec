import test from 'ava';
import ShellSpec from '..';

import aws from './mocks/aws';
import docker from './mocks/docker';
import git from './mocks/git';

test('aws 1', t => {

    const { getArgv } = ShellSpec(aws);

    const config = {
        debug: true,
        s3: {
            cp: {
                src: './foo',
                dest: './bar'
            }
        }
    };

    const argv = getArgv(config, 's3.cp');

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    t.deepEqual(argv, output);
});

test('aws 2', t => {

    const { getArgv } = ShellSpec(aws);

    const config = {
        debug: true,
        s3: {
            cp: {
                src: './foo'
            }
        }
    };

    const argv = getArgv(config, 's3.cp');

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo' ];

    t.deepEqual(argv, output);
});

test('docker build', t => {

    const { getArgv } = ShellSpec(docker);

    const config = {
        build: {
            name: 'foo',
            version: 'latest',
            context: '.'
        }
    };

    const argv = getArgv(config, 'build');

    const output = [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

    t.deepEqual(argv, output);
});

test('docker run', t => {

    const { getArgv } = ShellSpec(docker);

    const config = {
        run: {
            name: 'foo',
            version: 'latest',
            command: 'sh'
        }
    };

    const argv = getArgv(config, 'run');

    const output = [ 'docker', 'run', 'foo:latest', 'sh' ];

    t.deepEqual(argv, output);
});

test('git rev-parse defaults', t => {

    const { getArgv } = ShellSpec(git);

    const config = {};

    const argv = getArgv(config, 'rev-parse');

    const output = [ 'git', 'rev-parse', '--short=12', 'HEAD' ];

    t.deepEqual(argv, output);
});

test('git rev-parse w options', t => {

    const { getArgv } = ShellSpec(git);

    const config = {
        "rev-parse": {
            short: 8,
            refspec: "origin/master"
        }
    };

    const argv = getArgv(config, 'rev-parse');

    const output = [ 'git', 'rev-parse', '--short=8', 'origin/master' ];

    t.deepEqual(argv, output);
});

test('simple echo', t => {

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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        args: [ 'foo', 'bar', 123, true, false ]
    };

    const argv = getArgv(config);

    const output = [ 'echo', 'foo', 'bar', '123', 'true', 'false' ];

    t.deepEqual(argv, output);
});

test('with 1', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        'last-name': 'Heller-Ogden',
        formal: true
    };

    const argv = getArgv(config);

    const output = [ 'greet', '--formal', '--first-name', 'Jane', '--last-name', 'Heller-Ogden' ];

    t.deepEqual(argv, output);
});

test('with 2', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        formal: true
    };

    t.throws(() => getArgv(config), 'the option `formal` must be accompanied by `last-name`');
});

test('with 3', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        formal: true
    };

    t.throws(() => getArgv(config), 'the option `formal` must be accompanied by `last-name`');
});

test('without 1', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        casual: true
    };

    const argv = getArgv(config);

    const output = [ 'greet', '--casual', '--first-name', 'Jane' ];

    t.deepEqual(argv, output);
});

test('without 2', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        'last-name': 'Heller-Ogden',
        casual: true
    };

    t.throws(() => getArgv(config), 'the option `casual` and the option `last-name` cannot be used together');
});

test('without 3', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'greet',
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
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        'first-name': 'Jane',
        'last-name': 'Heller-Ogden',
        casual: true
    };

    t.throws(() => getArgv(config), 'the option `casual` and the option `last-name` cannot be used together');
});

// TODO - tricky bidness...
test('concatFlags', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            concatFlags: true,
            args: [
                {
                    name: 'a',
                    type: 'flag'
                },
                {
                    name: 'b',
                    type: 'flag'
                },
                {
                    name: 'c',
                    type: 'flag'
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        a: true,
        b: true,
        c: true
    };

    const argv = getArgv(config);

    const output = [ 'foo', '-abc' ];

    t.deepEqual(argv, output);
});

// TODO
test('concatFlags should only concat adjacent flags so as not to mess with arg order', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            concatFlags: 'adjacent',
            args: [
                {
                    name: 'a',
                    type: 'flag'
                },
                {
                    name: 'b',
                    type: 'value'
                },
                {
                    name: 'c',
                    type: 'flag'
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        a: true,
        b: 'bar',
        c: true
    };

    const argv = getArgv(config);

    const output = [ 'foo', '-a', 'bar', '-c' ];

    t.deepEqual(argv, output);
});

test('concatFlags 3', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            concatFlags: [ 'a', 'c' ],
            args: [
                {
                    name: 'a',
                    type: 'flag'
                },
                {
                    name: 'b',
                    type: 'flag'
                },
                {
                    name: 'c',
                    type: 'flag'
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        a: true,
        b: true,
        c: true
    };

    const argv = getArgv(config);

    const output = [ 'foo', '-ac', '-b' ];

    t.deepEqual(argv, output);
});

test('concatFlags cannot be used with useValue', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            concatFlags: [ 'a', 'c' ],
            args: [
                {
                    name: 'a',
                    type: 'flag'
                },
                {
                    name: 'b',
                    type: 'flag'
                },
                {
                    name: 'c',
                    type: 'flag',
                    useValue: true
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        a: true,
        b: true,
        c: true
    };

    t.throws(() => getArgv(config, 'foo'), 'Invalid use of `useValue` on concatted flag `c`');
});

test('concatFlags works at any level', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            args: [
                {
                    name: 'a',
                    type: 'flag'
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
                    command: 'bar',
                    concatFlags: true,
                    args: [
                        {
                            name: 'd',
                            type: 'flag'
                        },
                        {
                            name: 'e',
                            type: 'flag'
                        },
                        {
                            name: 'f',
                            type: 'flag'
                        },
                        {
                            command: 'baz',
                            args: [
                                {
                                    name: 'g',
                                    type: 'flag'
                                },
                                {
                                    name: 'h',
                                    type: 'flag'
                                },
                                {
                                    name: 'i',
                                    type: 'flag'
                                },
                                {
                                    command: 'qux',
                                    concatFlags: [ 'j', 'l' ],
                                    args: [
                                        {
                                            name: 'j',
                                            type: 'flag'
                                        },
                                        {
                                            name: 'k',
                                            type: 'flag'
                                        },
                                        {
                                            name: 'l',
                                            type: 'flag'
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        a: true,
        b: true,
        c: true,
        bar: {
            d: true,
            e: true,
            f: true,
            baz: {
                g: true,
                h: true,
                i: true,
                qux: {
                    j: true,
                    k: true,
                    l: true
                }
            }
        }
    };

    const argv = getArgv(config, 'bar.baz.qux');

    const output = [ 'foo', '-a', '-b', '-c', 'bar', '-def', 'baz', '-g', '-h', '-i', 'qux', '-jl', '-k' ];

    t.deepEqual(argv, output);
});

test('multiple same option', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            args: [
                {
                    name: 'bar',
                    type: 'option'
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        bar: [ 'a', 'b', 'c' ]
    };

    const argv = getArgv(config);

    const output = [ 'foo', '--bar', 'a', '--bar', 'b', '--bar', 'c' ];

    t.deepEqual(argv, output);
});

test('multiple same flag', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            args: [
                {
                    name: 'b',
                    type: 'flag'
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        b: [ 'a', 'b', 'c' ]
    };

    const argv = getArgv(config);

    const output = [ 'foo', '-b', '-b', '-b' ];

    t.deepEqual(argv, output);
});

test('multiple same flag with value', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            args: [
                {
                    name: 'b',
                    type: 'flag',
                    useValue: true
                }
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        b: [ 'a', 'b', 'c' ]
    };

    const argv = getArgv(config);

    const output = [ 'foo', '-b', 'a', '-b', 'b', '-b', 'c' ];

    t.deepEqual(argv, output);
});

test('arg can specify valid values as "choices"', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
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
    };

    const { getArgv } = ShellSpec(spec);

    t.deepEqual(getArgv({ bar: 'a' }), [ 'foo', '--bar', 'a' ]);
    t.throws(() => getArgv({ bar: 'd' }), 'the option `bar` has invalid value of "d". Valid values are: "a", "b", "c"');
});

test('double dash args are possible', t => {

    const { getArgv } = ShellSpec(git);

    const config = {
        add: {
            pathspec: [ './src', './dist' ]
        }
    };

    const argv = getArgv(config, 'add');

    const output = [ 'git', 'add', '--', './src', './dist' ];

    t.deepEqual(argv, output);
});
