import test from 'ava';
import ShellSpec from '..';

import aws from './mocks/aws';
import docker from './mocks/docker';
import git from './mocks/git';

test('aws 1', async t => {

    const { getArgv } = ShellSpec(aws);

    const input = {
        debug: true,
        s3: {
            cp: {
                src: './foo',
                dest: './bar'
            }
        }
    };

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    const argv = await getArgv(input, { name: 'aws.s3.cp' });

    t.deepEqual(argv, output);
});

test('aws 2', async t => {

    const { getArgv } = ShellSpec(aws);

    const input = {
        debug: true,
        s3: {
            cp: {
                src: './foo'
            }
        }
    };

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo' ];

    const argv = await getArgv(input, { name: 'aws.s3.cp' });

    t.deepEqual(argv, output);
});

test('docker build', async t => {

    const { getArgv } = ShellSpec(docker);

    const input = {
        build: {
            name: 'foo',
            version: 'latest',
            context: '.'
        }
    };

    const output = [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

    const argv = await getArgv(input, { name: 'docker.build' });

    t.deepEqual(argv, output);
});

test('docker run', async t => {

    const { getArgv } = ShellSpec(docker);

    const input = {
        run: {
            name: 'foo',
            version: 'latest',
            command: 'sh'
        }
    };

    const output = [ 'docker', 'run', 'foo:latest', 'sh' ];

    const argv = await getArgv(input, { name: 'docker.run' });

    t.deepEqual(argv, output);
});

test('git rev-parse defaults', async t => {

    const { getArgv } = ShellSpec(git);

    const input = {};

    const output = [ 'git', 'rev-parse', '--short=12', 'HEAD' ];

    const argv = await getArgv(input, { name: 'git.rev-parse' });

    t.deepEqual(argv, output);
});

test('git rev-parse w options', async t => {

    const { getArgv } = ShellSpec(git);

    const input = {
        "rev-parse": {
            short: 8,
            refspec: "origin/master"
        }
    };

    const output = [ 'git', 'rev-parse', '--short=8', 'origin/master' ];

    const argv = await getArgv(input, { name: 'git.rev-parse' });

    t.deepEqual(argv, output);
});
