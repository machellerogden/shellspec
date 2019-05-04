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

    const argv = getArgv('aws.s3.cp', config);

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

    const argv = getArgv('aws.s3.cp', config);

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

    const argv = getArgv('docker.build', config);

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

    const argv = getArgv('docker.run', config);

    const output = [ 'docker', 'run', 'foo:latest', 'sh' ];

    t.deepEqual(argv, output);
});

test('git rev-parse defaults', t => {

    const { getArgv } = ShellSpec(git);

    const config = {};

    const argv = getArgv('git.rev-parse', config);

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

    const argv = getArgv('git.rev-parse', config);

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

    const argv = getArgv('echo', config);

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

    const argv = getArgv('greet', config);

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

    t.throws(() => getArgv('greet', config), 'the option `formal` must be accompanied by `last-name`');
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

    t.throws(() => getArgv('greet', config), 'the option `formal` must be accompanied by `last-name`');
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

    const argv = getArgv('greet', config);

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

    t.throws(() => getArgv('greet', config), 'the option `casual` and the option `last-name` cannot be used together');
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

    t.throws(() => getArgv('greet', config), 'the option `casual` and the option `last-name` cannot be used together');
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

    const argv = getArgv('foo', config);

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

    const argv = getArgv('foo', config);

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

    const argv = getArgv('foo', config);

    const output = [ 'foo', '-ac', '-b' ];

    t.deepEqual(argv, output);
});

test.skip('concatFlags should work at any level', t => {

    const spec = {
        kind: 'shell',
        spec: {
            command: 'foo',
            args: [
                {
                    command: 'bar',
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
            ]
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        bar: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv('foo.bar', config);

    const output = [ 'foo', 'bar', '-abc' ];

    t.deepEqual(argv, output);
});
