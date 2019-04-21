import test from 'ava';
import ShellLoader from '..';

import aws from './mocks/aws';

test('basics 1', t => {

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

    const argv = loader(input);

    t.deepEqual(argv, output);
});

test('basics 2', t => {

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

    const argv = loader(input);

    t.deepEqual(argv, output);
});
