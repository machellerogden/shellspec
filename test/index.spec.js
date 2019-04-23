import test from 'ava';
import ShellLoader from '..';

import aws from './mocks/aws';
import docker from './mocks/docker';

test('aws 1', async t => {

    const loader = ShellLoader(aws);

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

    const argv = await loader('aws.s3.cp', input);

    t.deepEqual(argv, output);
});

test('aws 2', async t => {

    const loader = ShellLoader(aws);

    const input = {
        debug: true,
        s3: {
            cp: {
                src: './foo'
            }
        }
    };

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo' ];

    const argv = await loader('aws.s3.cp', input);

    t.deepEqual(argv, output);
});

test('docker 1', async t => {

    const loader = ShellLoader(docker);

    const input = {
        build: {
            name: 'foo',
            version: 'latest',
            context: '.'
        }
    };

    const output = [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

    const argv = await loader('docker.build', input);

    t.deepEqual(argv, output);
});
